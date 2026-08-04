// ============================================================
// File Parser Server Module — Document parsing & Excel analysis
// ============================================================
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const BASE = path.dirname(new URL(import.meta.url).pathname);
const FILE_PARSER = path.join(BASE, 'file_parser.py');
const COMPILER_DB = path.join(BASE, 'compiler.db');
const EXCEL_ANALYZER = path.join(BASE, 'excel_analyzer.py');
const FOLDERS_FILE = path.join(BASE, 'table_folders.json');

// ============================================================
// Folder management
// ============================================================
const DEFAULT_FOLDERS = [
  { id: 'general', name: '通用', icon: '📁', description: '未分类的表格' },
  { id: 'education', name: '教育/学习', icon: '📚', description: '学生、课程、成绩相关' },
  { id: 'hr', name: '人力资源', icon: '👥', description: '员工、部门、薪资相关' },
  { id: 'sales', name: '销售/客户', icon: '💰', description: '客户、订单、产品相关' },
  { id: 'finance', name: '财务/会计', icon: '📊', description: '账户、预算、报表相关' },
  { id: 'project', name: '项目管理', icon: '📋', description: '项目、任务、里程碑相关' },
  { id: 'inventory', name: '库存/物流', icon: '📦', description: '库存、仓库、供应商相关' },
  { id: 'tech', name: '技术/IT', icon: '💻', description: '服务器、数据库、配置相关' },
];

function loadFolders() {
  try {
    if (fs.existsSync(FOLDERS_FILE)) {
      return JSON.parse(fs.readFileSync(FOLDERS_FILE, 'utf-8'));
    }
  } catch {}
  // Initialize with default folders
  const data = {
    folders: DEFAULT_FOLDERS,
    tableAssignments: {}, // tableName -> folderId
  };
  saveFolders(data);
  return data;
}

function saveFolders(data) {
  fs.writeFileSync(FOLDERS_FILE, JSON.stringify(data, null, 2));
}

// Category name -> folder ID mapping
const CATEGORY_TO_FOLDER = {
  '教育/学习': 'education',
  '人力资源': 'hr',
  '销售/客户': 'sales',
  '财务/会计': 'finance',
  '项目管理': 'project',
  '库存/物流': 'inventory',
  '技术/IT': 'tech',
};

// ============================================================
// Parse document file for RAG
// ============================================================
export function parseDocForRAG(buffer, filename) {
  const tmpFile = path.join(BASE, `.tmp_rag_${Date.now()}_${filename}`);
  try {
    fs.writeFileSync(tmpFile, buffer);

    const out = execSync(`/usr/bin/python3 "${FILE_PARSER}" "${tmpFile}"`, {
      timeout: 30000, encoding: 'utf-8',
    });
    const result = JSON.parse(out.trim());

    if (result.error) {
      return { ok: false, msg: result.error };
    }

    // Python 解析器会拿临时文件路径当标题，这里恢复为原始文件名
    if (result.title && result.title.startsWith('.tmp_rag_')) {
      result.title = path.basename(filename || 'document').replace(/\.[^.]+$/, '');
    }

    return {
      ok: true,
      msg: `解析成功: ${result.sections.length} 个章节`,
      title: result.title,
      fileType: result.fileType,
      sections: result.sections.map((s, i) => ({
        id: `sec_${i}`,
        title: s.title || `第 ${i + 1} 节`,
        body: s.body || '',
        code: s.code || '',
        tip: s.tip || '',
      })),
      metadata: result.metadata || {},
    };
  } catch (e) {
    const stderr = e.stderr?.toString() || e.message || '解析失败';
    return { ok: false, msg: stderr.substring(0, 500) };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ============================================================
// Analyze Excel file for field info
// ============================================================
export function analyzeExcelFields(buffer, filename) {
  const tmpFile = path.join(BASE, `.tmp_excel_${Date.now()}_${filename}`);
  try {
    fs.writeFileSync(tmpFile, buffer);

    const out = execSync(`/usr/bin/python3 "${EXCEL_ANALYZER}" "${tmpFile}"`, {
      timeout: 15000, encoding: 'utf-8',
    });
    const result = JSON.parse(out.trim());

    if (result.error) {
      return { ok: false, msg: result.error };
    }

    // Determine folder assignment
    const folderData = loadFolders();
    const suggestedCategory = result.suggestedCategory || '通用';
    const folderId = CATEGORY_TO_FOLDER[suggestedCategory] || 'general';

    // Use original filename for table name (not the temp file path)
    const origExt = path.extname(filename || 'table.xlsx');
    const origBase = path.basename(filename || 'table.xlsx', origExt);
    const cleanTableName = origBase.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_');

    return {
      ok: true,
      msg: `分析完成: ${result.columnCount} 个字段, ${result.rowCount} 行数据`,
      tableName: cleanTableName,
      rowCount: result.rowCount,
      columnCount: result.columnCount,
      columns: result.columns,
      suggestedCategory,
      folderId,
      createSql: result.createSql,
    };
  } catch (e) {
    const stderr = e.stderr?.toString() || e.message || '分析失败';
    return { ok: false, msg: stderr.substring(0, 500) };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ============================================================
// Create table from Excel analysis
// ============================================================
export function createTableFromExcel(buffer, filename, options = {}) {
  const analysis = analyzeExcelFields(buffer, filename);
  if (!analysis.ok) return analysis;

  // Use original importExcel to create the table
  // (the analysis is separate from the actual creation)
  try {
    const tmpFile = path.join(BASE, `.tmp_create_${Date.now()}_${filename}`);
    fs.writeFileSync(tmpFile, buffer);

    // Use sqlite3 to create the table with proper schema
    // Generate CREATE TABLE SQL from analysis columns (with correct table name)
    const typeMap = { 'INTEGER': 'INTEGER', 'REAL': 'REAL', 'BOOLEAN': 'INTEGER', 'DATE': 'TEXT', 'TEXT': 'TEXT' };
    const colDefs = (analysis.columns || []).map(c => {
      return '    "' + c.name + '" ' + (typeMap[c.type] || 'TEXT');
    });
    const createSql = options.customSql || ('CREATE TABLE "' + analysis.tableName + '" (\n' + colDefs.join(',\n') + '\n);');

    // First: create the table (write SQL to temp file to avoid shell escaping issues)
    const tmpSql = path.join(BASE, '.tmp_create_sql_' + Date.now() + '.sql');
    fs.writeFileSync(tmpSql, createSql);
    execSync(`sqlite3 "${COMPILER_DB}" < "${tmpSql}"`, {
      timeout: 10000, stdio: 'pipe',
    });
    try { fs.unlinkSync(tmpSql); } catch {}

    // Then: import data using the original excel_parser.py
    const parserOut = execSync(
      `/usr/bin/python3 "${path.join(BASE, 'excel_parser.py')}" "${tmpFile}" --table-name "${analysis.tableName}"`,
      { timeout: 15000, encoding: 'utf-8' }
    );
    const parsed = JSON.parse(parserOut.trim());
    if (parsed.error) {
      return { ok: false, msg: parsed.error };
    }

    // Execute INSERT statements
    const tmpInsert = path.join(BASE, '.tmp_insert_' + Date.now() + '.sql');
    fs.writeFileSync(tmpInsert, parsed.insert_sql);
    execSync(`sqlite3 "${COMPILER_DB}" < "${tmpInsert}"`, {
      timeout: 15000, stdio: 'pipe',
    });
    try { fs.unlinkSync(tmpInsert); } catch {}

    // Assign to folder
    const folderData = loadFolders();
    const folderId = options.folderId || analysis.folderId || 'general';
    folderData.tableAssignments[analysis.tableName] = folderId;
    saveFolders(folderData);

    return {
      ok: true,
      msg: `表「${analysis.tableName}」创建成功: ${analysis.rowCount} 行 × ${analysis.columnCount} 列`,
      tableName: analysis.tableName,
      rowCount: analysis.rowCount,
      columns: analysis.columns,
      folderId,
      createSql,
    };
  } catch (e) {
    const stderr = e.stderr?.toString() || e.message || '创建失败';
    return { ok: false, msg: stderr.substring(0, 500) };
  }
}

// ============================================================
// Folder API
// ============================================================
export function getFolders() {
  return loadFolders();
}

export function moveTableToFolder(tableName, folderId) {
  const data = loadFolders();
  data.tableAssignments[tableName] = folderId;
  saveFolders(data);
  return { ok: true };
}

export function getTablesInFolder(folderId) {
  const data = loadFolders();
  const tables = [];
  for (const [name, fid] of Object.entries(data.tableAssignments)) {
    if (fid === folderId) tables.push(name);
  }
  return tables;
}
