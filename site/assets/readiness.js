/*
 * Tamnex continuous close-readiness demo: the single source of truth.
 * Synthetic data only. No network, no bank, no ERP, no AI model. Amounts are integers in halalas.
 * Every number, list and chart on the page is derived from `state` through evaluate(); nothing is
 * stored twice. A change to an input marks the checks it touches as "unverified" until the visitor
 * re-runs the checks, so an old result can never stand for new data.
 */
(function (root) {
  'use strict';

  var PERIOD_END = '2026-10-31';

  var SCENARIO = {
    company: 'شركة الوادي للتجارة (شركة تجريبية)',
    period: 'أكتوبر 2026',
    periodEnd: PERIOD_END,
    branch: 'فرع الرياض',
    bankLine: { id: 'BNK-1028', date: '2026-10-28', amount: 1150000, currency: 'SAR', text: 'تحويل وارد من مؤسسة النخبة التجارية' },
    candidates: [
      { id: 'RV-1039', party: 'مؤسسة النخبة التجارية', date: '2026-10-21', amount: 1150000, currency: 'SAR', usedBy: 'BNK-1019' },
      { id: 'RV-1047', party: 'مؤسسة الرواد', date: '2026-10-27', amount: 1105000, currency: 'SAR', usedBy: null },
      { id: 'RV-1042', party: 'مؤسسة النخبة التجارية', date: '2026-10-28', amount: 1150000, currency: 'SAR', usedBy: null }
    ],
    bankBalance: 24830000,        // bank statement and ledger agree; the gap is pairing only
    accrual: {
      amount: 400000,             // net of VAT
      debit: 'مصروف خدمات الحراسة والنظافة',
      credit: 'مصروفات مستحقة',
      attachment: 'عقد-حراسة-ونظافة-المستودع.pdf',
      clause: 'البند 4: 4,000.00 ر.س شهرياً قبل الضريبة، تُصدر الفاتورة في الخامس من الشهر التالي.',
      expenseBefore: 0,           // October movement on the service expense account
      accruedBefore: 1260000      // accrued expenses balance before this entry
    },
    inventory: {
      gl: 61240000,
      evidence: {
        'VAL-1029': { id: 'VAL-1029', title: 'تقرير تقييم المستودعات', asOf: '2026-10-29', value: 60875000 },
        'VAL-1031': { id: 'VAL-1031', title: 'تقرير تقييم المستودعات', asOf: '2026-10-31', value: 61240000 }
      },
      lateDoc: 'فاتورة شراء PI-2207 بتاريخ 2026-10-30، استُلمت بضاعتها في التاريخ نفسه، بقيمة 3,650.00 ر.س قبل الضريبة'
    },
    fixed: { ar: 18425000, ap: 9640000, vat: 4128000 }
  };

  var CHECKS = [
    { id: 'bank', title: 'البنك: كشف أكتوبر مطابق للسندات', owner: 'أمين الخزينة' },
    { id: 'clearing', title: 'المقبوضات غير المخصصة: لا شيء أقدم من 30 يوماً', owner: 'أمين الخزينة' },
    { id: 'ar', title: 'دفتر العملاء الفرعي يطابق حساب العملاء', owner: 'المحاسب' },
    { id: 'ap', title: 'دفتر الموردين الفرعي يطابق حساب الموردين', owner: 'المحاسب' },
    { id: 'inventory', title: 'تقييم المستودعات يطابق حساب المخزون', owner: 'مراقب المخزون' },
    { id: 'vat', title: 'حركة ضريبة المخرجات في الفواتير والإشعارات الدائنة = حركة حسابها', owner: 'المحاسب' },
    { id: 'expected', title: 'القيود المتوقعة: الخدمات والرواتب والإهلاك', owner: 'المحاسب' },
    { id: 'hygiene', title: 'لا مسودات معلقة في الفترة', owner: 'المحاسب' }
  ];

  function fmt(h) {
    var neg = h < 0; h = Math.abs(h);
    var s = Math.floor(h / 100).toLocaleString('en-US') + '.' + String(h % 100).padStart(2, '0');
    return neg ? '-' + s : s;
  }

  function initial() {
    return {
      matchedTo: null,
      accrual: 'missing',        // missing | draft | approved
      explained: false,
      inventoryEvidence: 'VAL-1029',
      dirty: {},                 // check id -> true when its inputs changed since the last run
      runs: 1,
      log: []
    };
  }

  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function touch(s, ids) { ids.forEach(function (id) { s.dirty[id] = true; }); }
  function note(s, text, kind) { s.log.push({ text: text, kind: kind || 'action' }); }

  /* ---------- Actions: each returns { state, ok, message } and never mutates its input ---------- */

  function matchBank(prev, candidateId) {
    var s = clone(prev);
    var c = SCENARIO.candidates.filter(function (x) { return x.id === candidateId; })[0];
    var line = SCENARIO.bankLine;
    if (!c) return { state: prev, ok: false, message: 'السند غير موجود.' };
    if (prev.matchedTo) return { state: prev, ok: false, message: 'الحركة مربوطة مسبقاً بـ ' + prev.matchedTo + '. ألغِ الربط أولاً.' };
    if (c.currency !== line.currency) return { state: prev, ok: false, message: 'العملة لا تطابق.' };
    if (c.amount !== line.amount) return { state: prev, ok: false, message: 'المبلغ لا يطابق: ' + fmt(c.amount) + ' مقابل ' + fmt(line.amount) + '.' };
    if (c.usedBy) return { state: prev, ok: false, message: 'السند ' + c.id + ' مربوط مسبقاً بالحركة ' + c.usedBy + '، ولا يُستخدم مرتين.' };
    s.matchedTo = c.id;
    touch(s, ['bank']);
    note(s, 'ربط الحركة ' + line.id + ' بسند القبض ' + c.id + ' (' + fmt(c.amount) + ' ر.س). لم يُنشأ قيد، ولم يتغير رصيد حساب البنك في الأستاذ.');
    return { state: s, ok: true, message: 'رُبطت الحركة بالسند ' + c.id + '. لم يُنشأ قيد، ولم يتغير رصيد حساب البنك في الأستاذ.' };
  }

  function unmatchBank(prev) {
    if (!prev.matchedTo) return { state: prev, ok: false, message: 'لا يوجد ربط لإلغائه.' };
    var s = clone(prev);
    note(s, 'إلغاء ربط الحركة ' + SCENARIO.bankLine.id + ' بالسند ' + prev.matchedTo + '.');
    s.matchedTo = null;
    touch(s, ['bank']);
    return { state: s, ok: true, message: 'أُلغي الربط.' };
  }

  function explainAccrual(prev) {
    var s = clone(prev);
    s.explained = true;
    return { state: s, ok: true, message: '' };
  }

  function saveAccrualDraft(prev) {
    if (prev.accrual !== 'missing') return { state: prev, ok: false, message: 'المسودة موجودة مسبقاً.' };
    var s = clone(prev);
    s.accrual = 'draft';
    touch(s, ['expected', 'hygiene']);
    note(s, 'حُفظت مسودة قيد استحقاق خدمات الحراسة والنظافة لأكتوبر (' + fmt(SCENARIO.accrual.amount) + ' ر.س). المسودة لا تغيّر الأرصدة.');
    return { state: s, ok: true, message: 'حُفظت المسودة. الاستثناء ما زال مفتوحاً حتى يعتمد المحاسب القيد.' };
  }

  function approveAccrual(prev) {
    if (prev.accrual !== 'draft') return { state: prev, ok: false, message: 'احفظ المسودة أولاً، ثم اعتمدها.' };
    var s = clone(prev);
    s.accrual = 'approved';
    touch(s, ['expected', 'hygiene']);
    note(s, 'اعتماد تجريبي يدوي لقيد الاستحقاق، طُبّق على دفتر المحاكاة في هذه الصفحة فقط. الاعتماد الفعلي يتطلب فصل المهام.', 'decision');
    return { state: s, ok: true, message: 'اعتُمد القيد تجريبياً على دفتر المحاكاة المحلي فقط.' };
  }

  function useInventoryEvidence(prev, id) {
    if (!SCENARIO.inventory.evidence[id]) return { state: prev, ok: false, message: 'الدليل غير موجود.' };
    if (prev.inventoryEvidence === id) return { state: prev, ok: false, message: 'هذا الدليل مربوط بالفحص الآن.' };
    var s = clone(prev);
    s.inventoryEvidence = id;
    touch(s, ['inventory']);
    var e = SCENARIO.inventory.evidence[id];
    note(s, 'ربط فحص المخزون بـ' + e.title + ' بتاريخ ' + e.asOf + '.');
    return { state: s, ok: true, message: 'رُبط الدليل. أعد الفحص للتحقق من التطابق والحداثة.' };
  }

  function runChecks(prev) {
    var s = clone(prev);
    s.dirty = {};
    s.runs += 1;
    var ev = evaluate(s);
    note(s, 'إعادة الفحص: ' + ev.complete + ' من ' + ev.total + ' فحوص مكتملة.', 'run');
    return { state: s, ok: true, message: '' };
  }

  /* ---------- Derivation: the only place status and numbers are computed ---------- */

  function raw(s, id) {
    var sc = SCENARIO;
    switch (id) {
      case 'bank':
        return s.matchedTo === 'RV-1042'
          ? { status: 'pass', detail: 'كل حركات الكشف والدفتر مطابقة، ولا بنود معلقة، والفرق 0.00.' }
          : { status: 'open', detail: 'حركة واحدة غير مطابقة: ' + fmt(sc.bankLine.amount) + ' ر.س بتاريخ ' + sc.bankLine.date + '.' };
      case 'clearing':
        return { status: 'pass', detail: 'لا مقبوضات غير مخصصة أقدم من 30 يوماً.' };
      case 'ar':
        return { status: 'pass', detail: 'الدفتر الفرعي ' + fmt(sc.fixed.ar) + ' = الأستاذ ' + fmt(sc.fixed.ar) + '.' };
      case 'ap':
        return { status: 'pass', detail: 'الدفتر الفرعي ' + fmt(sc.fixed.ap) + ' = الأستاذ ' + fmt(sc.fixed.ap) + '.' };
      case 'inventory': {
        var e = sc.inventory.evidence[s.inventoryEvidence];
        if (e.asOf !== sc.periodEnd) return { status: 'open', detail: 'الدليل لا يغطي نهاية الفترة (حتى ' + e.asOf + '): ' + fmt(e.value) + ' مقابل الأستاذ في ' + sc.periodEnd + ' ' + fmt(sc.inventory.gl) + '. الفرق ' + fmt(sc.inventory.gl - e.value) + '.' };
        if (e.value !== sc.inventory.gl) return { status: 'open', detail: 'التقييم لا يطابق الأستاذ. الفرق ' + fmt(sc.inventory.gl - e.value) + '.' };
        return { status: 'pass', detail: 'رصيد المستودعات في ' + e.asOf + ' = الأستاذ ' + fmt(sc.inventory.gl) + '. الفحص يطابق الدفتر الفرعي بالأستاذ ولا يثبت التقييم أو الجرد.' };
      }
      case 'vat':
        return { status: 'pass', detail: 'المستندات ' + fmt(sc.fixed.vat) + ' = حركة الحساب ' + fmt(sc.fixed.vat) + '.' };
      case 'expected':
        if (s.accrual === 'approved') return { status: 'pass', detail: 'خدمات أكتوبر مقيَّدة في دفتر المحاكاة. الرواتب والإهلاك مقيَّدة (بيانات السيناريو).' };
        if (s.accrual === 'draft') return { status: 'open', detail: 'مسودة استحقاق الخدمات بانتظار الاعتماد. توازن القيد وحده لا يكفي.' };
        return { status: 'open', detail: 'خدمات الحراسة والنظافة لأكتوبر غير مقيَّدة (' + fmt(sc.accrual.amount) + ' ر.س حسب العقد).' };
      case 'hygiene':
        return s.accrual === 'draft'
          ? { status: 'attention', detail: 'مسودة واحدة غير معتمدة: استحقاق الخدمات.' }
          : { status: 'pass', detail: 'لا مسودات معلقة.' };
    }
    return { status: 'open', detail: '' };
  }

  function evaluate(s) {
    var items = CHECKS.map(function (c) {
      var r = raw(s, c.id);
      var status = s.dirty[c.id] ? 'unverified' : r.status;
      return { id: c.id, title: c.title, owner: c.owner, status: status, detail: s.dirty[c.id] ? 'تغيّرت البيانات منذ آخر فحص. أعد الفحص.' : r.detail };
    });
    var complete = items.filter(function (i) { return i.status === 'pass'; }).length;
    var unverified = items.filter(function (i) { return i.status === 'unverified'; }).length;
    var blockers = items.filter(function (i) { return i.status !== 'pass'; });
    var verdict;
    if (unverified) verdict = { kind: 'stale', text: 'تغيّرت البيانات منذ آخر فحص. أعد الفحص قبل قراءة النتيجة.' };
    else if (!blockers.length) verdict = { kind: 'done', text: 'فحوص هذا السيناريو مكتملة، بانتظار مراجعة المحاسب.' };
    else if (complete > BASE_COMPLETE) verdict = { kind: 'better', text: 'تحسنت الجاهزية، وما زال مانع.' };
    else verdict = { kind: 'open', text: 'الإقفال غير جاهز: ' + blockers.length + ' فحوص مفتوحة.' };
    return {
      items: items, total: items.length, complete: complete, unverified: unverified, blockers: blockers, verdict: verdict,
      ledger: ledger(s)
    };
  }

  // Local simulation ledger: only an approved demo accrual changes it. Matching never does.
  function ledger(s) {
    var a = SCENARIO.accrual, on = s.accrual === 'approved';
    return {
      bank: SCENARIO.bankBalance,
      expense: a.expenseBefore + (on ? a.amount : 0),
      accrued: a.accruedBefore + (on ? a.amount : 0)
    };
  }

  var BASE_COMPLETE = 0;
  BASE_COMPLETE = evaluate(initial()).complete;

  var api = {
    SCENARIO: SCENARIO, CHECKS: CHECKS, fmt: fmt, initial: initial, evaluate: evaluate,
    matchBank: matchBank, unmatchBank: unmatchBank, explainAccrual: explainAccrual,
    saveAccrualDraft: saveAccrualDraft, approveAccrual: approveAccrual,
    useInventoryEvidence: useInventoryEvidence, runChecks: runChecks, BASE_COMPLETE: BASE_COMPLETE
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TamnexReadiness = api;
})(this);
