// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const endScreen = document.getElementById('end-screen');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const nextBtn = document.getElementById('next-btn'); // NEW

const yearSelect = document.getElementById('year-select');
const moduleSelect = document.getElementById('module-select');
const topicSelect = document.getElementById('topic-select');
const questionCountSelect = document.getElementById('question-count-select'); // NEW

const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const questionCounterEl = document.getElementById('question-counter');
const questionTextEl = document.getElementById('question-text');
const choicesContainer = document.getElementById('choices-container');
const explanationBox = document.getElementById('explanation-box'); // NEW
const explanationText = document.getElementById('explanation-text'); // NEW

const finalScoreEl = document.getElementById('final-score');

// --- State Variables ---
let quizStructure = {};
let allQuestionsForTopic = [];
let questions = []; // This will now be the sliced array of questions for the current quiz
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timeLeft = 10;

// --- Structure Loading and Dropdown Population ---
async function loadStructure() {
    try {
        const response = await fetch('data/manifest.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        quizStructure = await response.json();
        populateYears();
    } catch (error) {
        console.error("Could not load the quiz structure manifest:", error);
        alert("Failed to load quiz data. Please check manifest.json and console for errors.");
    }
}

function populateYears() {
    yearSelect.innerHTML = '<option value="">Select Year...</option>';
    Object.keys(quizStructure).forEach(year => yearSelect.add(new Option(year, year)));
    populateModules(''); // Reset child dropdowns
}

function populateModules(selectedYear) {
    moduleSelect.innerHTML = '<option value="">Select Module...</option>';
    moduleSelect.disabled = true;
    if (selectedYear && quizStructure[selectedYear]) {
        Object.keys(quizStructure[selectedYear]).forEach(module => moduleSelect.add(new Option(module, module)));
        moduleSelect.disabled = false;
    }
    populateTopics('', ''); // Reset topic dropdown
}

function populateTopics(selectedYear, selectedModule) {
    topicSelect.innerHTML = '<option value="">Select Topic...</option>';
    topicSelect.disabled = true;
    startBtn.disabled = true;
    if (selectedYear && selectedModule && quizStructure[selectedYear][selectedModule]) {
        Object.keys(quizStructure[selectedYear][selectedModule]).forEach(topic => topicSelect.add(new Option(topic, topic)));
        topicSelect.disabled = false;
    }
}

// --- Quiz Start and Question Loading ---
async function startQuiz() {
    const selectedYear = yearSelect.value;
    const selectedModule = moduleSelect.value;
    const selectedTopic = topicSelect.value;
    const filePath = quizStructure[selectedYear]?.[selectedModule]?.[selectedTopic];

    if (!filePath) {
        alert("Could not find the quiz file. Please check selections.");
        return;
    }

    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allQuestionsForTopic = (await response.json()).sort(() => Math.random() - 0.5); // Shuffle all available questions
    } catch (e) {
        alert("Failed to load questions. Please check the file path in manifest.json.");
        return;
    }
    
    // NEW: Get the desired number of questions and slice the array
    const questionCount = questionCountSelect.value;
    if (questionCount === 'all') {
        questions = allQuestionsForTopic;
    } else {
        questions = allQuestionsForTopic.slice(0, parseInt(questionCount, 10));
    }
    
    if (questions.length === 0) {
        alert("No questions available for this topic.");
        return;
    }

    currentQuestionIndex = 0;
    score = 0;
    scoreEl.textContent = 0;

    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    quizScreen.classList.remove('hidden');

    displayQuestion();
}

// --- Core Gameplay Logic (UPDATED) ---
function displayQuestion() {
    // Hide explanation and next button for the new question
    explanationBox.classList.add('hidden');
    nextBtn.classList.add('hidden');

    // Check if the quiz is over
    if (currentQuestionIndex >= questions.length) {
        endQuiz();
        return;
    }

    resetTimer();
    startTimer();

    const question = questions[currentQuestionIndex];
    questionCounterEl.textContent = `${currentQuestionIndex + 1}/${questions.length}`;
    questionTextEl.textContent = question.question;
    choicesContainer.innerHTML = '';
    
    // Re-enable buttons for the new question
    question.choices.forEach(choice => {
        const button = document.createElement('button');
        button.textContent = choice;
        button.className = 'w-full p-4 text-left font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500';
        button.onclick = () => checkAnswer(choice, button);
        choicesContainer.appendChild(button);
    });
}

function checkAnswer(selectedChoice, buttonEl) {
    clearInterval(timer); // Stop the timer
    const question = questions[currentQuestionIndex];
    const isCorrect = selectedChoice === question.answer;

    // Disable all choice buttons after an answer is selected
    document.querySelectorAll('#choices-container button').forEach(button => {
        button.disabled = true;
        if (button.textContent === question.answer) {
            button.classList.add('correct'); // Highlight the correct answer
        }
    });

    if (isCorrect) {
        score += 100 + (timeLeft * 10);
        scoreEl.textContent = score;
    } else {
        if (buttonEl) buttonEl.classList.add('incorrect'); // Highlight the user's wrong choice
    }
    
    // NEW: Show explanation immediately
    explanationText.textContent = question.explanation;
    explanationBox.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
}

// NEW: Function to proceed to the next question
function handleNextQuestion() {
    currentQuestionIndex++;
    displayQuestion();
}

function startTimer() {
    timeLeft = 10;
    timerEl.textContent = timeLeft;
    timer = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            // Time's up: select no answer and show explanation
            checkAnswer(null, null);
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timer);
}

function endQuiz() {
    quizScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');
    finalScoreEl.textContent = score;
}

function restartQuiz() {
    endScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    populateYears(); // Re-initialize the dropdowns
}

// --- Event Listeners ---
yearSelect.addEventListener('change', () => populateModules(yearSelect.value));
moduleSelect.addEventListener('change', () => populateTopics(yearSelect.value, moduleSelect.value));
topicSelect.addEventListener('change', () => { startBtn.disabled = !topicSelect.value; });

startBtn.addEventListener('click', startQuiz);
restartBtn.addEventListener('click', restartQuiz);
nextBtn.addEventListener('click', handleNextQuestion); // NEW

// --- Initializer ---
loadStructure();