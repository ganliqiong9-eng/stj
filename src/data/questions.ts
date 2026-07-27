export interface Question {
  id: string;
  subj: 'sql' | 'py' | 'da' | 'dma';
  q: string;
  answer: string;
  star: boolean;
}

export const defaultQuestions: Question[] = [
  {id:'q1', subj:'sql', q:'以下哪个 JOIN 会返回左表中的所有行？', answer:'B. LEFT JOIN — 保留左表所有行，右表无匹配时填充 NULL。', star:false},
  {id:'q2', subj:'sql', q:'INNER JOIN 和 LEFT JOIN 的核心区别是什么？', answer:'INNER JOIN 只返回匹配行（交集），LEFT JOIN 返回左表所有行（左表全集）。', star:true},
  {id:'q3', subj:'sql', q:'以下哪个函数用于统计行数？', answer:'COUNT() — 如 SELECT COUNT(*) FROM users。', star:false},
  {id:'q4', subj:'sql', q:'HAVING 和 WHERE 的区别？', answer:'WHERE 在 GROUP BY 之前过滤，HAVING 在之后过滤分组。', star:true},
  {id:'q5', subj:'sql', q:'NULL 值如何判断？', answer:'用 IS NULL 或 IS NOT NULL，不能使用 = NULL。', star:false},
  {id:'q6', subj:'py', q:'Python 中获取列表长度的函数是？', answer:'len() — 如 len([1,2,3]) 返回 3。', star:false},
  {id:'q7', subj:'py', q:'列表和元组的核心区别？', answer:'列表可变（mutable），元组不可变（immutable）。', star:true},
  {id:'q8', subj:'py', q:'字典的键有什么要求？', answer:'键必须是不可变类型（字符串、数字、元组），不能是列表。', star:false},
  {id:'q9', subj:'py', q:'break 和 continue 的区别？', answer:'break 跳出整个循环，continue 跳过当前次继续下一次。', star:false},
  {id:'q10', subj:'da', q:'维度建模的核心表类型？', answer:'事实表 (Fact) 和 维度表 (Dimension)。', star:false},
  {id:'q11', subj:'da', q:'数据清洗中处理缺失值的方法？', answer:'删除含缺失值的行、用均值/中位数填充、前向/后向填充。', star:true},
  {id:'q12', subj:'dma', q:'数据治理的核心目标？', answer:'确保数据的可用性、完整性、安全性、一致性和合规性。', star:true},
];

export const subjNames: Record<string, string> = {
  sql: 'SQL', py: 'Python', da: '数据分析', dma: 'DAMA'
};
