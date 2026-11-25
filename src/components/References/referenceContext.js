import { createContext } from 'react';

/** 引用目录与跳转命令；没有提供者时所有引用都按失效处理。 */
export const ReferenceContext = createContext({ references: new Map(), jump: null });
