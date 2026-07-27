export interface Chapter {
  id: string;
  courseId: string;
  title: string;
  subs: number;
  duration: string;
  status: 'done' | 'active' | 'pending';
}

export interface SubjectChapter {
  id: string;
  name: string;
  icon: string;
  color: string;
  pct: number;
  chapters: Chapter[];
}

export const subjectData: Record<string, SubjectChapter> = {
  sql: {
    id: 'sql', name: 'SQL 数据库', icon: 'S', color: '#1cb0f6', pct: 78,
    chapters: [
      {id:'s1', courseId:'sql', title:'SELECT 基础查询', subs:4, duration:'15 分钟', status:'done'},
      {id:'s2', courseId:'sql', title:'WHERE 条件过滤', subs:3, duration:'12 分钟', status:'done'},
      {id:'s3', courseId:'sql', title:'JOIN 多表连接', subs:5, duration:'25 分钟', status:'active'},
      {id:'s4', courseId:'sql', title:'窗口函数', subs:6, duration:'30 分钟', status:'pending'},
      {id:'s5', courseId:'sql', title:'子查询与 CTE', subs:4, duration:'20 分钟', status:'pending'},
    ]
  },
  py: {
    id: 'py', name: 'Python', icon: 'Py', color: '#ff9600', pct: 45,
    chapters: [
      {id:'p1', courseId:'py', title:'变量与数据类型', subs:4, duration:'15 分钟', status:'done'},
      {id:'p2', courseId:'py', title:'列表与循环', subs:4, duration:'18 分钟', status:'done'},
      {id:'p3', courseId:'py', title:'函数与模块', subs:5, duration:'22 分钟', status:'active'},
      {id:'p4', courseId:'py', title:'字典与集合', subs:4, duration:'16 分钟', status:'pending'},
    ]
  },
  da: {
    id: 'da', name: '数据分析', icon: 'DA', color: '#ce82ff', pct: 32,
    chapters: [
      {id:'d1', courseId:'da', title:'数据分析流程', subs:3, duration:'12 分钟', status:'done'},
      {id:'d2', courseId:'da', title:'数据清洗基础', subs:4, duration:'18 分钟', status:'active'},
      {id:'d3', courseId:'da', title:'可视化入门', subs:5, duration:'20 分钟', status:'pending'},
    ]
  },
  dma: {
    id: 'dma', name: 'DAMA 认证', icon: 'DM', color: '#58cc02', pct: 15,
    chapters: [
      {id:'m1', courseId:'dma', title:'数据管理概述', subs:3, duration:'15 分钟', status:'done'},
      {id:'m2', courseId:'dma', title:'数据治理框架', subs:5, duration:'25 分钟', status:'active'},
      {id:'m3', courseId:'dma', title:'数据架构', subs:6, duration:'30 分钟', status:'pending'},
    ]
  }
};

export const chaptersList: Chapter[] = Object.values(subjectData).flatMap(s => s.chapters);
