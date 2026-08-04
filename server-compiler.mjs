// ============================================================
// Compiler Engine Module — SQL execution, Python execution, Excel import
// ============================================================
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const BASE = path.dirname(new URL(import.meta.url).pathname);
const COMPILER_DB = path.join(BASE, 'compiler.db');
const SEED_SQL = path.join(BASE, 'seed.sql');
const EXCEL_PARSER = path.join(BASE, 'excel_parser.py');

// ============================================================
// Sample queries for users to try
// ============================================================
const SAMPLE_QUERIES = {
  sql: [
    { title: '查询所有员工', code: 'SELECT * FROM employees;' },
    { title: '按部门统计人数', code: 'SELECT department, COUNT(*) AS 人数, ROUND(AVG(salary)) AS 平均薪资\nFROM employees\nGROUP BY department\nORDER BY 平均薪资 DESC;' },
    { title: '高价值客户订单', code: 'SELECT c.name AS 客户, o.product AS 产品, o.amount AS 金额, o.order_date AS 下单日期\nFROM customers c\nINNER JOIN orders o ON c.id = o.customer_id\nWHERE o.amount > 3000\nORDER BY o.amount DESC;' },
    { title: 'JOIN 练习', code: '-- 查询学生和他们的选课成绩\nSELECT s.name AS 学生, c.name AS 课程, e.score AS 成绩, e.semester AS 学期\nFROM students s\nJOIN enrollments e ON s.id = e.student_id\nJOIN courses c ON e.course_id = c.id\nWHERE e.score >= 80\nORDER BY e.score DESC;' },
    { title: '城市客户消费排行', code: 'SELECT c.city AS 城市,\n       COUNT(DISTINCT c.id) AS 客户数,\n       SUM(o.amount) AS 总消费\nFROM customers c\nJOIN orders o ON c.id = o.customer_id\nGROUP BY c.city\nORDER BY 总消费 DESC;' },
  ],
  python: [
    { title: 'Hello World', code: 'print("欢迎使用 Python 编译器!")\nname = "学习伴侣"\nprint(f"你好, {name}!")' },
    { title: '数据计算', code: 'numbers = [85, 92, 78, 95, 88]\naverage = sum(numbers) / len(numbers)\nprint(f"成绩: {numbers}")\nprint(f"平均分: {average:.1f}")\nprint(f"最高分: {max(numbers)}")\nprint(f"最低分: {min(numbers)}")' },
    { title: "字典与 JSON", code: `# 学生信息
students = [
    {"name": "小明", "score": 85, "grade": "A"},
    {"name": "小红", "score": 92, "grade": "A"},
    {"name": "小刚", "score": 78, "grade": "B"},
]

for s in students:
    name = s["name"]
    score = s["score"]
    grade = s["grade"]
    print(name + ": " + str(score) + "分 (" + grade + ")")

high_scores = [ss for ss in students if ss["score"] >= 80]
print("优秀人数: " + str(len(high_scores)))` },

  ],
};

// ============================================================
// Database initialization
// ============================================================
export function initCompilerDB() {
  if (!fs.existsSync(COMPILER_DB)) {
    try {
      execSync(`sqlite3 "${COMPILER_DB}" < "${SEED_SQL}"`, { timeout: 10000, stdio: 'pipe' });
      console.log(`   Compiler DB: created with sample tables`);
    } catch (e) {
      console.error(`   Compiler DB init error:`, e.stderr?.toString()?.trim() || e.message);
    }
  }
}

// ============================================================
// SQL execution
// ============================================================
export function runSQL(code) {
  // Validate: basic safety — block DROP, DELETE without WHERE, shell commands
  const upper = code.trim().toUpperCase();
  if (upper.startsWith('DROP')) {
    return { ok: false, msg: '⚠️ DROP 操作已被禁止（练习环境）', columns: [], rows: [] };
  }
  if (upper.includes('DELETE') && !upper.includes('WHERE')) {
    return { ok: false, msg: '⚠️ DELETE 必须携带 WHERE 条件（练习环境）', columns: [], rows: [] };
  }

  try {
    // Write SQL to temp file with .mode json
    const tmpSql = path.join(BASE, '.tmp_compiler_run.sql');
    const tmpOut = path.join(BASE, '.tmp_compiler_out.json');

    // Determine if it's a query (returns rows) or DML/DDL
    const isQuery = /^\s*(SELECT|WITH|EXPLAIN|PRAGMA)/i.test(upper);
    let finalSql;

    if (isQuery) {
      finalSql = `.mode json\n.output "${tmpOut}"\n${code}\n.output stdout\n`;
    } else {
      finalSql = `${code}\nSELECT json_object('changes', changes()) AS json_result;\n`;
    }

    fs.writeFileSync(tmpSql, finalSql);
    execSync(`sqlite3 "${COMPILER_DB}" < "${tmpSql}"`, { timeout: 10000, stdio: 'pipe' });

    let output = '';
    let columns = [];
    let rows = [];

    if (isQuery && fs.existsSync(tmpOut)) {
      const raw = fs.readFileSync(tmpOut, 'utf-8').trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          columns = Object.keys(parsed[0]);
          rows = parsed.map(r => columns.map(c => r[c]));
          output = `查询成功: 返回 ${rows.length} 行`;
        } else if (Array.isArray(parsed)) {
          output = `查询成功: 返回 0 行`;
        } else if (parsed.changes !== undefined) {
          output = `执行成功: 影响 ${parsed.changes} 行`;
        } else {
          output = `执行成功`;
        }
      } else {
        output = '执行成功（无返回数据）';
      }
      try { fs.unlinkSync(tmpOut); } catch {}
    } else if (!isQuery) {
      output = '执行成功';
    } else {
      output = '执行成功（无返回数据）';
    }

    try { fs.unlinkSync(tmpSql); } catch {}

    return { ok: true, msg: output, columns, rows };
  } catch (e) {
    const stderr = e.stderr?.toString() || '';
    // Extract meaningful error message
    let msg = stderr.trim();
    if (!msg) msg = e.message || 'SQL 执行错误';
    // Clean up common noise
    msg = msg.replace(/^Error: /, '');
    return { ok: false, msg: msg.substring(0, 500), columns: [], rows: [] };
  }
}

// ============================================================
// Python execution
// ============================================================
export function runPython(code) {
  const tmpPy = path.join(BASE, '.tmp_compiler_py.py');
  const tmpOut = path.join(BASE, '.tmp_compiler_py_out.txt');

  try {
    // Wrap user code to capture all output
    const wrapper = `import sys, json, math, random, statistics
sys.stdout = open("${tmpOut.replace(/\\/g, '\\\\')}", "w", encoding="utf-8")
sys.stderr = sys.stdout

try:
${code.split('\n').map(l => '    ' + l).join('\n')}
except Exception as _e:
    print(f"Error: {_e}", file=sys.__stdout__)
`;

    fs.writeFileSync(tmpPy, wrapper);
    execSync(`/usr/bin/python3 "${tmpPy}"`, { timeout: 8000, stdio: 'pipe' });

    let output = '';
    if (fs.existsSync(tmpOut)) {
      output = fs.readFileSync(tmpOut, 'utf-8').trim();
      try { fs.unlinkSync(tmpOut); } catch {}
    }
    try { fs.unlinkSync(tmpPy); } catch {}

    if (!output) output = '(无输出)';
    return { ok: true, msg: output, columns: [], rows: [] };
  } catch (e) {
    let stderr = e.stderr?.toString() || '';
    // If timeout
    if (e.signal === 'SIGTERM') {
      stderr = '执行超时（超过 8 秒，可能包含无限循环）';
    }
    if (!stderr) stderr = e.message || 'Python 执行错误';
    try { fs.unlinkSync(tmpPy); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
    return { ok: false, msg: stderr.substring(0, 1000), columns: [], rows: [] };
  }
}

// ============================================================
// List tables
// ============================================================
export function listTables() {
  try {
    if (!fs.existsSync(COMPILER_DB)) return [];
    const out = execSync(`sqlite3 "${COMPILER_DB}" ".tables"`, { timeout: 5000, encoding: 'utf-8' });
    const names = out.trim().split(/\s+/).filter(Boolean);
    const tables = names.map(name => {
      try {
        const schema = execSync(`sqlite3 "${COMPILER_DB}" ".schema \\"${name}\\""`, { timeout: 3000, encoding: 'utf-8' });
        const count = execSync(`sqlite3 "${COMPILER_DB}" "SELECT COUNT(*) FROM \\"${name}\\""`, { timeout: 3000, encoding: 'utf-8' });
        // Extract column names from schema
        const colMatch = schema.match(/\(([\s\S]*)\)/);
        let columns = [];
        if (colMatch) {
          columns = colMatch[1].split(',')
            .map(s => s.trim())
            .filter(s => !s.toUpperCase().startsWith('FOREIGN') && !s.toUpperCase().startsWith('PRIMARY'))
            .map(s => s.split(/\s+/)[0]?.replace(/["`]/g, '') || '');
        }
        return { name, columns, rowCount: parseInt(count.trim()) || 0 };
      } catch {
        return { name, columns: [], rowCount: 0 };
      }
    });
    return tables;
  } catch {
    return [];
  }
}

// ============================================================
// Get table data
// ============================================================
export function getTableData(tableName) {
  try {
    if (!fs.existsSync(COMPILER_DB)) return { columns: [], rows: [] };
    const out = execSync(`sqlite3 -json "${COMPILER_DB}" "SELECT * FROM \\"${tableName}\\" LIMIT 200"`, { timeout: 5000, encoding: 'utf-8' });
    const parsed = JSON.parse(out.trim() || '[]');
    const columns = parsed.length > 0 ? Object.keys(parsed[0]) : [];
    const rows = parsed.map(r => columns.map(c => r[c]));
    return { columns, rows };
  } catch {
    return { columns: [], rows: [] };
  }
}

// ============================================================
// Import Excel
// ============================================================
export function importExcel(buffer, tableName) {
  const tmpXlsx = path.join(BASE, '.tmp_compiler_import.xlsx');
  try {
    fs.writeFileSync(tmpXlsx, buffer);

    let cmd = `/usr/bin/python3 "${EXCEL_PARSER}" "${tmpXlsx}"`;
    if (tableName) cmd += ` --table-name "${tableName}"`;

    const out = execSync(cmd, { timeout: 15000, encoding: 'utf-8' });
    const result = JSON.parse(out.trim());

    if (result.error) {
      return { ok: false, msg: result.error };
    }

    // Create table in SQLite
    const createSql = result.create_sql;
    const insertSql = result.insert_sql;

    // Drop existing table first if needed
    execSync(`sqlite3 "${COMPILER_DB}" "DROP TABLE IF EXISTS \\"${result.table_name}\\""`, { timeout: 5000 });
    execSync(`sqlite3 "${COMPILER_DB}" "${createSql}"`, { timeout: 5000, stdio: 'pipe' });
    execSync(`sqlite3 "${COMPILER_DB}" "${insertSql}"`, { timeout: 15000, stdio: 'pipe' });

    return {
      ok: true,
      msg: `成功导入表格「${result.table_name}」: ${result.rows} 行 × ${result.columns.length} 列`,
      tableName: result.table_name,
      rowCount: result.rows,
      columns: result.columns,
    };
  } catch (e) {
    const stderr = e.stderr?.toString() || e.message || '导入失败';
    return { ok: false, msg: stderr.substring(0, 500) };
  } finally {
    try { fs.unlinkSync(tmpXlsx); } catch {}
  }
}

// ============================================================
// Reset database
// ============================================================
export function resetDatabase() {
  try {
    if (fs.existsSync(COMPILER_DB)) fs.unlinkSync(COMPILER_DB);
    initCompilerDB();
    return { ok: true, msg: '数据库已重置为初始示例数据' };
  } catch (e) {
    return { ok: false, msg: '重置失败: ' + (e.message || '') };
  }
}

// ============================================================
// Get sample queries
// ============================================================
export function getSampleQueries() {
  return SAMPLE_QUERIES;
}
