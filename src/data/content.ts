export interface Section {
  title: string;
  body: string;
  code?: string;
  tip?: string;
}

export interface CourseContent {
  id: string;
  title: string;
  sections: Section[];
}

export const courseContent: Record<string, CourseContent> = {
  's1': {
    id: 's1', title: 'SELECT 基础查询',
    sections: [
      {
        title: 'SELECT 语句结构',
        body: 'SELECT 是 SQL 中最常用的语句，用于从数据库中检索数据。基本语法为 SELECT 列名 FROM 表名。',
        code: 'SELECT column1, column2\nFROM table_name;',
        tip: '使用 * 可以选中所有列，但生产环境建议显式指定列名。'
      },
      {
        title: '查询指定列',
        body: '可以只查询需要的列，减少数据传输量。多个列用逗号分隔。',
        code: 'SELECT first_name, last_name, email\nFROM employees;',
        tip: '查询结果按 SELECT 中写的列顺序返回。'
      },
      {
        title: '使用别名 (AS)',
        body: '使用 AS 关键字可以为列或表设置别名，让结果更易读。',
        code: 'SELECT\n  first_name AS "名字",\n  last_name  AS "姓氏",\n  salary * 12 AS "年薪"\nFROM employees;',
        tip: 'AS 可以省略，用空格代替。中文别名建议加引号。'
      }
    ]
  },
  's2': {
    id: 's2', title: 'WHERE 条件过滤',
    sections: [
      {
        title: 'WHERE 子句',
        body: 'WHERE 用于过滤记录，只返回满足条件的行。支持比较运算符（=, <>, >, <, >=, <=）和逻辑运算符（AND, OR, NOT）。',
        code: 'SELECT name, age, city\nFROM users\nWHERE age >= 18 AND city = \'北京\';',
        tip: '字符串值需要用单引号括起来。'
      },
      {
        title: 'IN 和 BETWEEN',
        body: 'IN 用于匹配多个值中的一个，BETWEEN 用于范围查询（包含边界）。',
        code: '-- IN 示例\nSELECT * FROM products\nWHERE category IN (\'电子\', \'家电\', \'数码\');\n\n-- BETWEEN 示例\nSELECT * FROM orders\nWHERE total BETWEEN 100 AND 500;',
        tip: 'BETWEEN 是闭区间，等价于 total >= 100 AND total <= 500。'
      },
      {
        title: 'LIKE 模糊匹配',
        body: 'LIKE 用于模式匹配。% 匹配任意字符序列，_ 匹配单个字符。',
        code: 'SELECT name FROM employees\nWHERE name LIKE \'张%\'; -- 所有姓张的员工',
        tip: '% 是通配符，放在不同位置效果不同：张%、%张%、%张%'
      }
    ]
  },
  's3': {
    id: 's3', title: 'JOIN 多表连接',
    sections: [
      {
        title: 'INNER JOIN 内部连接',
        body: '返回两个表中满足连接条件的匹配行。如果某行在任一表中没有匹配，则不会出现在结果中。',
        code: 'SELECT o.order_id, c.customer_name\nFROM orders o\nINNER JOIN customers c\n  ON o.customer_id = c.customer_id;',
        tip: '只返回有关联的数据行，适合事实表关联维度表。'
      },
      {
        title: 'LEFT JOIN 左连接',
        body: '返回左表所有行，右表无匹配时填充 NULL。这是最常用的外连接。',
        code: 'SELECT c.customer_id, o.order_id\nFROM customers c\nLEFT JOIN orders o\n  ON c.customer_id = o.customer_id;',
        tip: '适合查「哪些客户从未下单」等场景。'
      }
    ]
  },
  'p1': {
    id: 'p1', title: '变量与数据类型',
    sections: [
      {
        title: '变量声明与赋值',
        body: 'Python 变量不需要声明类型，直接赋值即可。变量名区分大小写，不能以数字开头。',
        code: 'name = "小明"     # 字符串\nage = 25         # 整数\nheight = 1.75    # 浮点数\nis_student = True # 布尔值',
        tip: '用 type() 函数可以查看变量类型。'
      },
      {
        title: '字符串操作',
        body: 'Python 提供了丰富的字符串处理方法。',
        code: 'text = "Hello, Python!"\nprint(text.lower())    # 小写\nprint(text.upper())    # 大写\nprint(len(text))       # 长度\nprint(text.split(",")) # 分割',
        tip: 'f-string 是 Python 3.6+ 推荐的格式化方式。'
      }
    ]
  },
  'd1': {
    id: 'd1', title: '数据分析流程',
    sections: [
      {
        title: '数据分析的五个步骤',
        body: '数据分析通常遵循：定义问题 → 收集数据 → 数据清洗 → 分析建模 → 结果解读。每个步骤都同样重要。',
        code: '# 数据分析典型流程\nimport pandas as pd\n\n# 1. 加载数据\ndf = pd.read_csv(\'sales.csv\')\n\n# 2. 数据概览\nprint(df.head())\nprint(df.info())\n\n# 3. 描述统计\nprint(df.describe())',
        tip: 'EDA（探索性数据分析）是理解数据的关键步骤。'
      }
    ]
  },
  'm1': {
    id: 'm1', title: '数据管理概述',
    sections: [
      {
        title: '什么是数据管理',
        body: '数据管理是为确保数据资产的价值而进行的规划、执行和监督活动。涵盖数据治理、数据架构、数据建模等多个领域。',
        code: '-- 数据管理的关键领域\n-- 1. 数据治理：制定政策与标准\n-- 2. 数据架构：设计数据结构\n-- 3. 数据建模：ER图、维度建模\n-- 4. 数据质量：完整性、准确性',
        tip: 'DAMA-DMBOK 是数据管理领域的核心参考框架。'
      }
    ]
  }
};

// 通用回退内容
export const fallbackContent: CourseContent = {
  id: 'fallback', title: '内容准备中',
  sections: [
    {
      title: '📖 本节内容正在生成中',
      body: 'AI 正在为你准备本节课程的学习内容，请稍后再回来查看。届时将包含详细的概念讲解、代码示例和实践练习。',
      tip: '先去看看题库里的相关题目，或者看看其他已完成章节吧。'
    }
  ]
};
