import React, { useState, useRef, useEffect } from 'react';

const TestPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [currentQuestions, setCurrentQuestions] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictedAnswers, setPredictedAnswers] = useState([]);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [streamingQuestions, setStreamingQuestions] = useState({});
  const messagesEndRef = useRef(null);
  const [customAnswer, setCustomAnswer] = useState('');
  const [currentStep, setCurrentStep] = useState('input');
  const [topic, setTopic] = useState('');
  const containerRef = useRef(null);

  const questionsByRound = {
    1: [
      "What is your understanding of the basic concepts?",
      "How would you explain this to a beginner?",
      "What are the fundamental principles?"
    ],
    2: [
      "Can you elaborate on the advanced features?",
      "What are the common challenges?",
      "How does this relate to real-world applications?"
    ],
    3: [
      "What are the best practices?",
      "How do you handle edge cases?",
      "What future developments do you anticipate?"
    ]
  };

  const dummyPredictions = [
    "Basic level response focusing on fundamentals",
    "Intermediate explanation with practical examples",
    "Advanced analysis with technical details",
    "Expert perspective with industry insights",
    "Comprehensive overview with latest trends"
  ];

  const streamText = (fullText, questionIndex) => {
    let currentText = '';
    const words = fullText.split('');
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex >= words.length) {
        clearInterval(interval);
        return;
      }

      currentText += words[currentIndex];
      setStreamingQuestions(prev => ({
        ...prev,
        [questionIndex]: currentText
      }));
      currentIndex++;
    }, 50);
  };

  const displayQuestions = (questions) => {
    setCurrentQuestions(questions);
    setStreamingQuestions({});
    
    questions.forEach((question, index) => {
      setTimeout(() => {
        setStreamingQuestions(prev => ({
          ...prev,
          [index]: ''
        }));
        streamText(question, index);
      }, index * 300);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const simulateTyping = (text, callback) => {
    setIsTyping(true);
    let currentText = '';
    const words = text.split(' ');
    
    const interval = setInterval(() => {
      if (words.length === 0) {
        clearInterval(interval);
        setIsTyping(false);
        if (callback) callback();
        return;
      }
      currentText += words.shift() + ' ';
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          type: 'ai',
          content: currentText.trim()
        };
        return newMessages;
      });
    }, 200);
  };

  const startNewRound = () => {
    setMessages(prev => [...prev, { 
      type: 'ai', 
      content: `Let's move on to round ${currentRound}. Here are your questions:` 
    }]);
    displayQuestions(questionsByRound[currentRound]);
    setAnsweredQuestions([]);
    setCurrentStep('questions');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setTopic(inputValue);
    setMessages(prev => [...prev, { type: 'user', content: inputValue }]);
    setMessages(prev => [...prev, { type: 'ai', content: '' }]);
    
    simulateTyping(
      `Let's explore ${inputValue}. We'll go through three rounds of questions to deeply understand this topic.`,
      startNewRound
    );

    setInputValue('');
    setCurrentStep('typing');
  };

  const handleQuestionClick = (question) => {
    if (answeredQuestions.includes(question)) return;
    setSelectedQuestion(question);
    setPredictedAnswers(dummyPredictions);
    setShowPredictions(true);
  };

  const processAnswer = (answer) => {
    setMessages(prev => [
      ...prev,
      { type: 'user', content: `${selectedQuestion}\nAnswer: ${answer}` }
    ]);

    const newAnsweredQuestions = [...answeredQuestions, selectedQuestion];
    setAnsweredQuestions(newAnsweredQuestions);

    if (newAnsweredQuestions.length === 3) {
      if (currentRound < 3) {
        setCurrentRound(prev => prev + 1);
        setTimeout(startNewRound, 1000);
      } else {
        setMessages(prev => [...prev, { 
          type: 'ai', 
          content: 'Congratulations! You have completed all three rounds of questions. Would you like to explore another topic?' 
        }]);
        setCurrentRound(1);
        setCurrentStep('input');
      }
    }

    setShowPredictions(false);
  };

  const handlePredictionSelect = (prediction) => {
    processAnswer(prediction);
  };

  const handleCustomAnswer = (e) => {
    e.preventDefault();
    if (!customAnswer.trim()) return;
    processAnswer(customAnswer);
    setCustomAnswer('');
  };

  // Card component with dynamic width
  const QuestionCard = ({ question, index, isAnswered, onClick }) => (
    <div 
      className={`flex-1 min-w-0 transition-all duration-500 ease-in-out transform hover:scale-102 ${
        isAnswered ? 'opacity-50' : 'hover:shadow-xl'
      }`}
      style={{ flex: '1 1 0' }}
    >
      <div 
        className={`h-full m-2 p-6 rounded-xl border transition-all duration-300 ${
          isAnswered 
            ? 'bg-gray-50 border-gray-200' 
            : 'bg-white border-blue-200 hover:border-blue-400 cursor-pointer'
        }`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-500">
            Question {index + 1}
          </span>
          {isAnswered && (
            <span className="text-green-500 text-xl">✓</span>
          )}
        </div>
        <div className="min-h-[100px] flex items-center">
          <p className="text-lg font-medium leading-relaxed">
            {streamingQuestions[index] || ''}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-6xl bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 p-4 text-white">
          <h1 className="text-xl font-bold">AI Learning Assistant</h1>
          {topic && (
            <div className="text-sm mt-1">
              Topic: {topic} - Round {currentRound}/3
            </div>
          )}
        </div>

        {/* Messages Container */}
        <div className="h-[400px] overflow-y-auto p-6 bg-gray-50">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div
                className={`max-w-[70%] rounded-xl p-4 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white ml-auto'
                    : 'bg-white shadow-md'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center space-x-2 text-gray-400 p-4">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Questions Cards Section */}
        {currentQuestions.length > 0 && (
          <div className="p-4 border-t border-gray-200" ref={containerRef}>
            <div className="flex w-full">
              {currentQuestions.map((question, index) => (
                <QuestionCard
                  key={index}
                  question={question}
                  index={index}
                  isAnswered={answeredQuestions.includes(question)}
                  onClick={() => handleQuestionClick(question)}
                />
              ))}
            </div>
            <div className="text-sm text-gray-500 mt-4 text-center">
              {3 - answeredQuestions.length} questions remaining in this round
            </div>
          </div>
        )}

        {/* Predictions Modal */}
        {showPredictions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">{selectedQuestion}</h3>
              <div className="space-y-3">
                {predictedAnswers.map((prediction, index) => (
                  <button
                    key={index}
                    onClick={() => handlePredictionSelect(prediction)}
                    className="w-full p-4 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200 border border-gray-200"
                  >
                    {prediction}
                  </button>
                ))}
                <div className="pt-4 border-t">
                  <form onSubmit={handleCustomAnswer}>
                    <input
                      type="text"
                      value={customAnswer}
                      onChange={(e) => setCustomAnswer(e.target.value)}
                      placeholder="Or type your own answer..."
                      className="w-full p-3 border rounded-lg mb-3"
                    />
                    <button
                      type="submit"
                      className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      Submit Custom Answer
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Section */}
        {currentStep === 'input' && (
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
            <div className="flex space-x-4">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter a topic to discuss..."
                className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Start
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TestPage;
