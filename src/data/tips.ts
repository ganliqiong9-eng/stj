export interface Tip {
  emoji: string;
  tag: string;
  title: string;
  saying: string;
  explain: string;
}

export const tips: Tip[] = [
  {emoji:'💖',tag:'SQL',title:'今日知识点',saying:'SELECT 就像在相亲软件上筛选对象',explain:'你写上 <code>SELECT * FROM users WHERE age > 25</code>，就从数据库的「候选人池」里精确捞人。'},
  {emoji:'💔',tag:'SQL',title:'这个比喻绝了',saying:'LEFT JOIN 就像单方面喜欢一个人',explain:'左表所有行都保留，右表有回应才有数据。像极了<strong>一厢情愿</strong>——不回应就是 NULL。'},
  {emoji:'💑',tag:'SQL',title:'新知识点',saying:'INNER JOIN 是双向奔赴',explain:'两边都匹配才出现。就像<strong>你表白 TA 也同意</strong>，两个人都 say yes 才算一对。'},
  {emoji:'🤔',tag:'SQL',title:'别搞混了',saying:'NULL 不是 0，是「不知道」',explain:'0 分是打了分但得了 0，NULL 是根本没打分。就像问你对象多高，0cm 是有一个 0cm 高的对象，NULL 是你<strong>根本没对象</strong>。'},
  {emoji:'🗂️',tag:'SQL',title:'今天学了吗',saying:'GROUP BY 就像朋友圈分组',explain:'把所有人按城市分组。就像整理微信通讯录，按北京看多少人、上海看多少人，<strong>每个城市一摞</strong>。'},
  {emoji:'🥟',tag:'Python',title:'新知识点',saying:'变量就像在冰箱上贴标签',explain:'<code>bag = ["包子","饺子"]</code> 就是拿便签写上 bag，贴在盒子上。想用的时候<strong>喊 bag 就行</strong>。'},
  {emoji:'🔁',tag:'Python',title:'今日知识点',saying:'for 循环就像餐厅叫号机',explain:'<code>for 客人 in 排队列表:</code> 叫号机一个个叫，叫完为止。<strong>不用手动喊每个人</strong>。'},
  {emoji:'🎯',tag:'Python',title:'这个比喻绝了',saying:'函数就像菜谱',explain:'写一次函数随时调用，就像学会番茄炒蛋菜谱，每次想吃就照做，<strong>不用重新发明做法</strong>。'},
  {emoji:'🏛️',tag:'DAMA',title:'今日知识点',saying:'数据治理就像城市管理',explain:'数据是市民，标准是交通规则，数据质量是市容检查，数据安全是警察局。<strong>没治理的城市乱成一锅粥</strong>。'},
  {emoji:'📋',tag:'DAMA',title:'新知识点',saying:'数据字典就像户口本',explain:'每个数据项的名字、类型、含义都登记在册。就像公安局的<strong>户口档案</strong>。'},
  {emoji:'🧹',tag:'DAMA',title:'别搞混了',saying:'数据质量检查就像打扫房间',explain:'重复数据=垃圾扔掉，缺失数据=缺腿家具要补，错误数据=涂鸦要擦。<strong>定期打扫才住得舒服</strong>。'},
];
