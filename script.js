// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const endScreen = document.getElementById('end-screen');
const allScreens = document.querySelectorAll('.screen');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const nextBtn = document.getElementById('next-btn');
const bookmarkBtn = document.getElementById('bookmark-btn');
const dailyChallengeBtn = document.getElementById('daily-challenge-btn');
const startBookmarkedBtn = document.getElementById('start-bookmarked-btn');
const reviewMistakesBtn = document.getElementById('review-mistakes-btn');

const yearSelect = document.getElementById('year-select');
const moduleSelect = document.getElementById('module-select');
const topicSelect = document.getElementById('topic-select');
const questionCountSelect = document.getElementById('question-count-select');

const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const questionCounterEl = document.getElementById('question-counter');
const questionImageEl = document.getElementById('question-image');
const questionTextEl = document.getElementById('question-text');
const choicesContainer = document.getElementById('choices-container');
const explanationBox = document.getElementById('explanation-box');
const explanationText = document.getElementById('explanation-text');
const finalScoreEl = document.getElementById('final-score');

// --- State Variables ---
let quizStructure = {};
let masterQuestionList = [];
let bookmarkedQuestions = [];
let incorrectlyAnswered = [];
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timeLeft = 10;

// --- Utility & Setup Functions ---

const playSound = (sound) => {
    try {
        new Audio(`assets/sounds/${sound}.mp3`).play();
    } catch (e) {
        console.warn("Sound could not be played.", e);
    }
};

const showScreen = (screenId) => {
    allScreens.forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
};

const loadBookmarks = () => {
    const saved = localStorage.getItem('medQuizBookmarks');
    bookmarkedQuestions = saved ? JSON.parse(saved) : [];
    startBookmarkedBtn.classList.toggle('hidden', bookmarkedQuestions.length === 0);
};

const saveBookmarks = () => {
    localStorage.setItem('medQuizBookmarks', JSON.stringify(bookmarkedQuestions));
    startBookmarkedBtn.classList.toggle('hidden', bookmarkedQuestions.length === 0);
};

// --- Data Loading ---
async function initializeApp() {
    loadBookmarks();
    try {
        const response = await fetch('data/manifest.json');
        if (!response.ok) throw new Error('Manifest not found');
        quizStructure = await response.json();
        populateYears();
        preloadAllQuestions(); // Preload for daily/bookmarked quizzes
    } catch (error) {
        console.error("Could not initialize app:", error);
        alert("Failed to load critical app data. Please check your connection or the data files.");
    }
}

async function preloadAllQuestions() {
    const allFilePaths = [];
    for (const year in quizStructure) {
        for (const module in quizStructure[year]) {
            for (const topic in quizStructure[year][module]) {
                allFilePaths.push(quizStructure[year][module][topic]);
            }
        }
    }

    const allPromises = allFilePaths.map(path =>
        fetch(path)
            .then(res => res.json())
            .then(data => data.map(q => ({ ...q, sourceTopic: path }))) // Add source for identification
            .catch(() => []) // Handle failed fetches gracefully
    );

    const allQuestionArrays = await Promise.all(allPromises);
    masterQuestionList = allQuestionArrays.flat();
    console.log(`Preloaded ${masterQuestionList.length} questions in total.`);
}

// --- Dropdown Population ---
function populateYears() {
    yearSelect.innerHTML = '<option value="">Select Year...</option>';
    Object.keys(quizStructure).forEach(year => yearSelect.add(new Option(year, year)));
    populateModules('');
}

function populateModules(selectedYear) {
    moduleSelect.innerHTML = '<option value="">Select Module...</option>';
    moduleSelect.disabled = true;
    if (selectedYear && quizStructure[selectedYear]) {
        Object.keys(quizStructure[selectedYear]).forEach(module => moduleSelect.add(new Option(module, module)));
        moduleSelect.disabled = false;
    }
    populateTopics('', '');
}

function populateTopics(selectedYear, selectedModule) {
    topicSelect.innerHTML = '<option value="">Select Topic...</option>';
    topicSelect.disabled = true;
    startBtn.disabled = true;
    if (selectedYear && selectedModule && quizStructure[selectedYear][selectedModule]) {
        Object.keys(quizStructure[selectedYear][moduleSelect.value]).forEach(topic => topicSelect.add(new Option(topic, topic)));
        topicSelect.disabled = false;
    }
}

// --- Quiz Start Logic ---
function setupAndStartQuiz(questionArray, mode = "standard") {
    if (!questionArray || questionArray.length === 0) {
        alert(mode === 'bookmarks' ? 'You have no bookmarked questions!' : 'No questions available for this quiz.');
        return;
    }

    // For standard quizzes, slice by user selection. For others, use all provided.
    if (mode === 'standard') {
        const count = questionCountSelect.value;
        questions = count === 'all' ? questionArray : questionArray.slice(0, parseInt(count, 10));
    } else {
        questions = questionArray;
    }
    
    currentQuestionIndex = 0;
    score = 0;
    incorrectlyAnswered = [];
    scoreEl.textContent = 0;
    reviewMistakesBtn.classList.add('hidden');

    showScreen('quiz-screen');
    displayQuestion();
}

async function startTopicQuiz() {
    playSound('click');
    const filePath = quizStructure[yearSelect.value]?.[moduleSelect.value]?.[topicSelect.value];
    if (!filePath) return;

    try {
        const response = await fetch(filePath);
        let questionsForTopic = await response.json();
        questionsForTopic = questionsForTopic.sort(() => Math.random() - 0.5);
        setupAndStartQuiz(questionsForTopic, 'standard');
    } catch (e) {
        alert('Could not load this topic. Please try another.');
    }
}

function startDailyChallenge() {
    playSound('click');
    if (masterQuestionList.length === 0) {
        alert("Questions are still loading, please wait a moment.");
        return;
    }
    const shuffled = [...masterQuestionList].sort(() => Math.random() - 0.5);
    setupAndStartQuiz(shuffled.slice(0, 10), 'daily'); // Daily challenge is always 10 questions
}

function startBookmarkedQuiz() {
    playSound('click');
    const bookmarkedFullQuestions = masterQuestionList.filter(q => 
        bookmarkedQuestions.includes(q.question)
    );
    setupAndStartQuiz(bookmarkedFullQuestions.sort(() => Math.random() - 0.5), 'bookmarks');
}

function startReviewQuiz() {
    playSound('click');
    setupAndStartQuiz(incorrectlyAnswered.sort(() => Math.random() - 0.5), 'review');
}

// --- Gameplay Logic ---
function displayQuestion() {
    explanationBox.classList.add('hidden');
    nextBtn.classList.add('hidden');
    
    if (currentQuestionIndex >= questions.length) {
        endQuiz();
        return;
    }
    
    resetTimer();
    startTimer();

    const question = questions[currentQuestionIndex];
    questionCounterEl.textContent = `${currentQuestionIndex + 1}/${questions.length}`;
    questionTextEl.textContent = question.question;

    // Handle image
    if (question.image) {
        questionImageEl.src = question.image;
        questionImageEl.classList.remove('hidden');
    } else {
        questionImageEl.classList.add('hidden');
    }

    // Handle bookmark status
    bookmarkBtn.classList.toggle('bookmarked', bookmarkedQuestions.includes(question.question));

    choicesContainer.innerHTML = '';
    question.choices.forEach(choice => {
        const button = document.createElement('button');
        button.textContent = choice;
        button.className = 'w-full p-4 text-left font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors';
        button.onclick = () => { playSound('click'); checkAnswer(choice, button); };
        choicesContainer.appendChild(button);
    });
}

function checkAnswer(selectedChoice, buttonEl) {
    clearInterval(timer);
    const question = questions[currentQuestionIndex];
    const isCorrect = selectedChoice === question.answer;

    if (isCorrect) {
        playSound('correct');
        score += 100 + (timeLeft * 10);
        scoreEl.textContent = score;
    } else {
        playSound('incorrect');
        incorrectlyAnswered.push(question);
        if (buttonEl) buttonEl.classList.add('incorrect');
    }

    document.querySelectorAll('#choices-container button').forEach(button => {
        button.disabled = true;
        if (button.textContent === question.answer) {
            button.classList.add('correct');
        }
    });

    explanationText.textContent = question.explanation;
    explanationBox.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
}

function toggleBookmark() {
    playSound('click');
    const questionText = questions[currentQuestionIndex].question;
    const index = bookmarkedQuestions.indexOf(questionText);

    if (index > -1) {
        bookmarkedQuestions.splice(index, 1); // Unbookmark
        bookmarkBtn.classList.remove('bookmarked');
    } else {
        bookmarkedQuestions.push(questionText); // Bookmark
        bookmarkBtn.classList.add('bookmarked');
    }
    saveBookmarks();
}

function handleNextQuestion() {
    playSound('click');
    currentQuestionIndex++;
    displayQuestion();
}

function startTimer() { /* Unchanged */ }
function resetTimer() { /* Unchanged */ }

function endQuiz() {
    finalScoreEl.textContent = score;
    if(incorrectlyAnswered.length > 0) {
        reviewMistakesBtn.classList.remove('hidden');
    }
    showScreen('end-screen');
}

function restartQuiz() {
    playSound('click');
    populateYears(); // Resets dropdowns
    showScreen('start-screen');
}

// --- Event Listeners ---
yearSelect.addEventListener('change', () => populateModules(yearSelect.value));
moduleSelect.addEventListener('change', () => populateTopics(yearSelect.value, moduleSelect.value));
topicSelect.addEventListener('change', () => { startBtn.disabled = !topicSelect.value; });

startBtn.addEventListener('click', startTopicQuiz);
restartBtn.addEventListener('click', restartQuiz);
nextBtn.addEventListener('click', handleNextQuestion);
bookmarkBtn.addEventListener('click', toggleBookmark);
dailyChallengeBtn.addEventListener('click', startDailyChallenge);
startBookmarkedBtn.addEventListener('click', startBookmarkedQuiz);
reviewMistakesBtn.addEventListener('click', startReviewQuiz);


// --- Initialize App ---
initializeApp();