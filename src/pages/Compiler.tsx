import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const sqlExamples = [
  `-- 查询用户订单
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.total > 100
ORDER BY o.total DESC;`,
  `-- 统计各城市用户数
SELECT city, COUNT(*) as cnt
FROM users
GROUP BY city
HAVING cnt > 5;`
];

const pyExamples = [
  `# 列表推导式
nums = [1, 2, 3, 4, 5]
sq = [n**2 for n in nums]
print(f"平方: {sq}")`,
  `# 数据分析
import pandas as pd
d = {'name': ['A','B'], 'score': [85,92]}
df = pd.DataFrame(d)
print(df.describe())`
];

export default function Compiler() {
  const nav = useNavigate();
  const [lang, setLang] = useState<'sql' | 'python'>('sql');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState<{ ok: boolean; msg: string }>({ ok: true, msg: '等待校验...' });

  const runCheck = () => {
    const trimmed = code.trim();
    if (!trimmed) { setOutput({ ok: false, msg: '请输入代码' }); return; }

    if (lang === 'sql') {
      const upper = trimmed.toUpperCase();
      if (!/^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|EXPLAIN)/.test(upper)) {
        setOutput({ ok: false, msg: 'SQL 应以 SELECT/INSERT/UPDATE/DELETE/CREATE 等开头' });
        return;
      }
      let bal = 0;
      for (const ch of trimmed) { if (ch === '(') bal++; if (ch === ')') bal--; }
      if (bal !== 0) { setOutput({ ok: false, msg: '括号不匹配' }); return; }
      setOutput({ ok: true, msg: 'SQL 语法校验通过' });
    } else {
      // Python 基础语法静态检查（非完整解析，仅捕获明显错误）
      const lines = trimmed.split('\n');
      const errors: string[] = [];
      let pBal = 0, bBal = 0, cBal = 0;
      const kwNeedsColon = /^(def |class |if |elif |else|for |while |with |try|except |finally|match )/;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const stripped = line.replace(/#.*$/, '').trimEnd();
        if (!stripped || stripped.startsWith('#')) continue;
        // 括号匹配
        for (const ch of stripped.replace(/(['"]).*?\1/g, '')) {
          if (ch === '(') pBal++;
          if (ch === ')') pBal--;
          if (ch === '[') bBal++;
          if (ch === ']') bBal--;
          if (ch === '{') cBal++;
          if (ch === '}') cBal--;
        }
        // 需要冒号的语句缺少冒号
        if (kwNeedsColon.test(stripped.trimStart()) && !stripped.trimEnd().endsWith(':') && !stripped.trimEnd().endsWith('\\')) {
          errors.push(`第 ${i + 1} 行: '${stripped.trimStart().split(/[ (:]/)[0]}' 语句末尾缺少 ':'`);
        }
        // 缩进检查：非空行不能以单个空格开头（要么不缩进，要么4空格/1tab）
        const indent = line.match(/^( +)/);
        if (indent && indent[1].length % 4 !== 0 && indent[1].length !== 0) {
          errors.push(`第 ${i + 1} 行: 缩进为 ${indent[1].length} 空格，Python 标准缩进为 4 空格`);
        }
      }
      if (pBal !== 0) errors.push(`圆括号不匹配（差 ${Math.abs(pBal)} 个 ${pBal > 0 ? '(' : ')'}）`);
      if (bBal !== 0) errors.push(`方括号不匹配（差 ${Math.abs(bBal)} 个 ${bBal > 0 ? '[' : ']'}）`);
      if (cBal !== 0) errors.push(`花括号不匹配（差 ${Math.abs(cBal)} 个 ${cBal > 0 ? '{' : '}'}）`);
      if (errors.length > 0) {
        setOutput({ ok: false, msg: '发现以下问题:\n' + errors.slice(0, 5).join('\n') });
      } else {
        setOutput({ ok: true, msg: 'Python 基础语法校验通过（仅检查括号/缩进/冒号）' });
      }
    }
  };

  const insertExample = () => {
    const examples = lang === 'sql' ? sqlExamples : pyExamples;
    setCode(examples[Math.floor(Math.random() * examples.length)]);
    setOutput({ ok: true, msg: '已插入示例' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.shiftKey && e.key === 'Enter') { e.preventDefault(); runCheck(); }
  };

  return (
    <div className="page">
      <div className="status-bar"><span>9:45</span><span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="10" viewBox="0 0 14 10" style={{display:'block'}}><rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor"/><rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor"/></svg><svg width="18" height="10" viewBox="0 0 18 10" style={{display:'block'}}><rect x="0.5" y="1" width="14" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="0.8"/><rect x="2" y="2.5" width="9" height="5" rx="0.8" fill="currentColor"/><rect x="15" y="3.5" width="2" height="3" rx="0.8" fill="currentColor"/></svg></span></div>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px 2px'}}>
        <button onClick={() => nav('/')} style={{
          width:32, height:32, borderRadius:8, border:'none',
          background:'var(--surface)', color:'var(--text-secondary)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'var(--shadow-sm)', fontSize:18, flexShrink:0
        }}>‹</button>
        <h2 style={{fontSize:17, fontWeight:700, flex:1}}>代码编译器</h2>
        <select value={lang} onChange={e => { setLang(e.target.value as 'sql' | 'python'); setCode(''); setOutput({ ok: true, msg: '等待校验...' }); }}
          style={{
            padding:'4px 10px', borderRadius:8, border:'2px solid var(--border)',
            background:'var(--surface)', fontSize:12, fontFamily:'var(--font)',
            fontWeight:600, color:'var(--text)'
          }}>
          <option value="sql">SQL</option>
          <option value="python">Python</option>
        </select>
      </div>
      <div style={{flex:1, margin:'4px 12px 6px', borderRadius:'var(--radius)',
        overflow:'hidden', border:'2px solid var(--border)', display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', gap:2, padding:'4px 8px', background:'#2b2b2b'}}>
          {['sql', 'python'].map(l => (
            <button key={l} onClick={() => { setLang(l as 'sql' | 'python'); setCode(''); setOutput({ ok: true, msg: '等待校验...' }); }}
              style={{
                padding:'5px 16px', borderRadius:6, fontSize:11, fontWeight:600,
                border:'none', cursor:'pointer', fontFamily:'var(--font)',
                background: lang === l ? '#555' : 'transparent', color: lang === l ? '#fff' : '#999'
              }}>{l === 'sql' ? 'SQL' : 'Python'}</button>
          ))}
        </div>
        <textarea value={code} onChange={e => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={lang === 'sql' ? '-- 输入 SQL 代码\nSELECT * FROM users;' : '# 输入 Python 代码\nprint("hello")'}
          style={{
            flex:1, resize:'none', border:'none', outline:'none', padding:'14px 16px',
            fontFamily:'var(--mono)', fontSize:13, lineHeight:1.6,
            background:'#2b2b2b', color:'#f0f0f0', tabSize:2
          }} />
        <div style={{
          background:'#2b2b2b', borderTop:'1px solid #444', padding:'10px 14px',
          minHeight:54, fontFamily:'var(--mono)', fontSize:12, lineHeight:1.5,
          color: output.ok ? 'var(--green)' : 'var(--rose)', overflowY:'auto'
        }}>
          {output.ok ? '✓ ' : '✗ '}{output.msg}
        </div>
      </div>
      <div style={{display:'flex', gap:8, padding:'0 12px'}}>
        <button onClick={runCheck} style={{
          flex:1, padding:'12px 0', border:'none', borderRadius:'var(--radius-sm)',
          fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)',
          background:'var(--primary)', color:'#fff',
          boxShadow:'0 4px 12px rgba(28,176,246,.3)'
        }}>▶ 校验语法</button>
        <button onClick={insertExample} style={{
          padding:'12px 16px', border:'2px solid var(--border)',
          borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:700,
          cursor:'pointer', fontFamily:'var(--font)',
          background:'var(--surface)', color:'var(--text)'
        }}>📋 示例</button>
      </div>
      <div style={{fontSize:10, color:'var(--text-tertiary)', padding:'4px 16px 2px'}}>
        快捷键: Shift+Enter
      </div>
    </div>
  );
}
