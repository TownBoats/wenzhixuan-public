import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import './i18n';
import AnswerCard from './components/AnswerCard/AnswerCard';

const answers = ['三次握手？没听懂题目。', '听过 SYN、ACK，但没懂过程。', '我发 SYN，你回 SYN+ACK，我再 ACK。', '双方换序号，确认双向收发，再建连。', '同步 ISN，确认双向可达，拒旧连接。'];
const keys = ['none', 'heard', 'basic', 'familiar', 'expert'];
function Review() {
  const [long, setLong] = useState(false);
  const [result, setResult] = useState('');
  return <div className="fixed inset-0 bg-paper-100">
    <button onClick={() => setLong(!long)}>切换长答案</button>
    <output>{result}</output>
    <AnswerCard question={{ question: '你能用自己的话描述一下 TCP 三次握手的大致过程吗？', answer: Object.fromEntries(keys.map((key, i) => [key, [{content: long ? answers[i].repeat(25) : answers[i]}]])) }} onLevelSelect={(level, value) => setResult(`${level}: ${value}`)} onClose={() => {}} />
  </div>;
}
createRoot(document.getElementById('root')).render(<Review />);
