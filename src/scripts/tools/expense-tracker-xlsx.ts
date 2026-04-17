import {
  defaultExpenseTrackerState,
  normalizeExpenseTrackerState,
  normalizeHttpsUrl,
  parseTags,
  subscriptionNextChargeIso,
  type ExpenseAttachment,
  type ExpenseReminder,
  type ExpenseRow,
  type ExpenseTrackerState,
  type IncomeAdhocRow,
  type PaycheckEntry,
  type SubscriptionRow,
} from "@lib/tools-expense-tracker";

const SH_GASTOS = "Gastos";
const SH_INGRESOS = "Ingresos";
const SH_SUBS = "Suscripciones";
const SH_REM = "Recordatorios";
const SH_META = "Meta";
const SH_TAGS = "TagBank";
const SH_PAY = "Cobros";

export async function exportExpenseTrackerXlsx(state: ExpenseTrackerState): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SkillAtlas";
  wb.created = new Date();

  const wsG = wb.addWorksheet(SH_GASTOS, { views: [{ state: "frozen", ySplit: 1 }] });
  wsG.columns = [
    { header: "id", key: "id", width: 38 },
    { header: "fecha", key: "date", width: 12 },
    { header: "concepto", key: "label", width: 28 },
    { header: "importe", key: "amount", width: 12 },
    { header: "moneda", key: "currency", width: 8 },
    { header: "categoria_id", key: "categoryId", width: 22 },
    { header: "etiquetas", key: "tags", width: 24 },
    { header: "adjuntos", key: "attachments", width: 48 },
    { header: "notas", key: "notes", width: 28 },
    { header: "confirmado", key: "confirmado", width: 12 },
  ];
  wsG.getRow(1).font = { bold: true };
  for (const e of state.expenses) {
    const att = e.attachments.map((a) => `${a.title}|${a.url}`).join("; ");
    wsG.addRow({
      id: e.id,
      date: e.date,
      label: e.label,
      amount: e.amount,
      currency: e.currency,
      categoryId: e.categoryId,
      tags: e.tags.join("; "),
      attachments: att,
      notes: e.notes,
      confirmado: e.confirmed === false ? "no" : "si",
    });
  }

  const wsI = wb.addWorksheet(SH_INGRESOS, { views: [{ state: "frozen", ySplit: 1 }] });
  wsI.columns = [
    { header: "id", key: "id", width: 38 },
    { header: "fecha", key: "date", width: 12 },
    { header: "concepto", key: "label", width: 28 },
    { header: "importe", key: "amount", width: 12 },
    { header: "moneda", key: "currency", width: 8 },
    { header: "categoria_id", key: "categoryId", width: 22 },
    { header: "etiquetas", key: "tags", width: 24 },
    { header: "adjuntos", key: "attachments", width: 48 },
    { header: "notas", key: "notes", width: 28 },
    { header: "confirmado", key: "confirmado", width: 12 },
  ];
  wsI.getRow(1).font = { bold: true };
  for (const e of state.incomeAdhoc ?? []) {
    const att = (e.attachments ?? []).map((a) => `${a.title}|${a.url}`).join("; ");
    wsI.addRow({
      id: e.id,
      date: e.date,
      label: e.label,
      amount: e.amount,
      currency: e.currency,
      categoryId: e.categoryId,
      tags: (e.tags ?? []).join("; "),
      attachments: att,
      notes: e.notes ?? "",
      confirmado: e.confirmed === false ? "no" : "si",
    });
  }

  const wsS = wb.addWorksheet(SH_SUBS, { views: [{ state: "frozen", ySplit: 1 }] });
  wsS.columns = [
    { header: "id", key: "id", width: 38 },
    { header: "nombre", key: "name", width: 28 },
    { header: "importe", key: "amount", width: 12 },
    { header: "moneda", key: "currency", width: 8 },
    { header: "ciclo", key: "cycle", width: 12 },
    { header: "categoria_id", key: "categoryId", width: 22 },
    { header: "fecha_inicio", key: "billingStartDate", width: 14 },
    { header: "proximo_cargo", key: "nextBilling", width: 14 },
    { header: "activa", key: "active", width: 8 },
    { header: "etiquetas", key: "tags", width: 24 },
    { header: "notas", key: "notes", width: 28 },
  ];
  wsS.getRow(1).font = { bold: true };
  for (const s of state.subscriptions) {
    wsS.addRow({
      id: s.id,
      name: s.name,
      amount: s.amount,
      currency: s.currency,
      cycle: s.cycle,
      categoryId: s.categoryId,
      billingStartDate: s.billingStartDate ?? "",
      nextBilling: s.nextBilling,
      active: s.active ? "si" : "no",
      tags: s.tags.join("; "),
      notes: s.notes,
    });
  }

  const wsR = wb.addWorksheet(SH_REM, { views: [{ state: "frozen", ySplit: 1 }] });
  wsR.columns = [
    { header: "id", key: "id", width: 38 },
    { header: "titulo", key: "title", width: 28 },
    { header: "fecha", key: "date", width: 12 },
    { header: "nota", key: "note", width: 36 },
    { header: "notificar", key: "notify", width: 12 },
    { header: "gasto_id", key: "expenseId", width: 38 },
  ];
  wsR.getRow(1).font = { bold: true };
  for (const r of state.reminders) {
    wsR.addRow({
      id: r.id,
      title: r.title,
      date: r.date,
      note: r.note,
      notify: r.notifyBrowser ? "si" : "no",
      expenseId: r.expenseId ?? "",
    });
  }

  const wsM = wb.addWorksheet(SH_META);
  wsM.addRow(["clave", "valor"]);
  wsM.addRow(["schema", "skillatlas_expense_tracker_v2"]);
  wsM.addRow(["eurPerUsd", state.eurPerUsd]);
  wsM.addRow(["chartMoneyMode", state.chartMoneyMode]);
  wsM.addRow(["period", state.period]);
  wsM.addRow(["chartFilterCategoryId", state.chartFilterCategoryId || ""]);
  wsM.getColumn(1).width = 22;
  wsM.getColumn(2).width = 36;

  const wsP = wb.addWorksheet(SH_PAY, { views: [{ state: "frozen", ySplit: 1 }] });
  wsP.columns = [
    { header: "id", key: "id", width: 38 },
    { header: "titulo", key: "title", width: 28 },
    { header: "dia_mes", key: "day", width: 10 },
    { header: "ventana_antes", key: "window", width: 14 },
    { header: "nota", key: "note", width: 36 },
  ];
  wsP.getRow(1).font = { bold: true };
  for (const p of state.paychecks ?? []) {
    wsP.addRow({
      id: p.id,
      title: p.title,
      day: p.dayOfMonth,
      window: p.windowBefore ?? "",
      note: p.note ?? "",
    });
  }

  const wsT = wb.addWorksheet(SH_TAGS);
  wsT.addRow(["tag"]);
  wsT.getRow(1).font = { bold: true };
  for (const t of state.tagBank) wsT.addRow([t]);
  wsT.getColumn(1).width = 28;

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function rowVals(row: import("exceljs").Row): string[] {
  const map = new Map<number, string>();
  let max = 0;
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    max = Math.max(max, colNumber);
    const v = cell.value;
    const s =
      v == null
        ? ""
        : typeof v === "object" && v !== null && "text" in (v as any)
          ? String((v as any).text)
          : String(v);
    map.set(colNumber - 1, s.trim());
  });
  const out: string[] = [];
  for (let i = 0; i < max; i++) out.push(map.get(i) ?? "");
  return out;
}

function findHeaderRow(sheet: import("exceljs").Worksheet, want: string[]): number | null {
  for (let r = 1; r <= Math.min(sheet.rowCount, 30); r++) {
    const vals = rowVals(sheet.getRow(r)).map((v) => v.toLowerCase());
    if (want.every((w) => vals.some((c) => c.includes(w)))) return r;
  }
  return null;
}

function colIndex(header: string[], name: string): number {
  const n = name.toLowerCase();
  const i = header.findIndex((h) => h.toLowerCase() === n || h.toLowerCase().includes(n));
  return i;
}

export async function importExpenseTrackerXlsx(buffer: ArrayBuffer): Promise<ExpenseTrackerState | null> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return null;
  }

  const base = defaultExpenseTrackerState();
  let eurPerUsd = base.eurPerUsd;
  let chartMoneyMode = base.chartMoneyMode;
  let period = base.period;
  let chartFilterCategoryId = "";

  const wsM = wb.getWorksheet(SH_META);
  if (wsM) {
    wsM.eachRow((row, rn) => {
      if (rn === 1) return;
      const [k, v] = rowVals(row);
      if (k === "eurPerUsd") eurPerUsd = Number(v) || eurPerUsd;
      if (k === "chartMoneyMode" && (v === "mixed" || v === "unify_eur" || v === "unify_usd")) chartMoneyMode = v;
      if (v && (k === "period" || k === "período")) {
        if (v === "all" || v === "12m" || v === "90d" || v === "30d" || v === "6m" || v === "ytd") period = v as typeof period;
      }
      if (k.toLowerCase() === "chartfiltercategoryid" && v) chartFilterCategoryId = v.trim();
    });
  }

  const expenses: ExpenseRow[] = [];
  const wsG = wb.getWorksheet(SH_GASTOS);
  if (wsG) {
    const hr = findHeaderRow(wsG, ["fecha", "concepto"]) ?? 1;
    const h = rowVals(wsG.getRow(hr)).map((x) => x.trim());
    const iId = colIndex(h, "id");
    const iDate = colIndex(h, "fecha");
    const iLabel = colIndex(h, "concepto");
    const iAmt = colIndex(h, "importe");
    const iCur = colIndex(h, "moneda");
    const iCat = colIndex(h, "categoria_id");
    const iTags = colIndex(h, "etiquetas");
    const iAtt = colIndex(h, "adjuntos");
    const iNotes = colIndex(h, "notas");
    const iConf = colIndex(h, "confirmado");
    for (let r = hr + 1; r <= wsG.rowCount; r++) {
      const cells = rowVals(wsG.getRow(r));
      if (!cells.some((c) => c)) continue;
      const pick = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
      const id = pick(iId) || `xlsx_${Math.random().toString(16).slice(2)}`;
      const date = pick(iDate).slice(0, 10);
      const label = pick(iLabel) || "Gasto";
      const amount = Number(pick(iAmt).replace(",", ".")) || 0;
      const currency = pick(iCur) === "USD" ? "USD" : "EUR";
      const categoryId = pick(iCat) || base.categories[0]!.id;
      const tags = parseTags(pick(iTags));
      const notes = pick(iNotes);
      const confCell = iConf >= 0 ? pick(iConf) : "";
      const confirmed = !/^no$/i.test(confCell);
      const attachments: ExpenseAttachment[] = [];
      const attCell = pick(iAtt);
      if (attCell) {
        for (const part of attCell.split(";")) {
          const p = part.trim();
          if (!p) continue;
          const pipe = p.indexOf("|");
          const title = pipe >= 0 ? p.slice(0, pipe).trim() : "Enlace";
          const urlRaw = pipe >= 0 ? p.slice(pipe + 1).trim() : p;
          const url = normalizeHttpsUrl(urlRaw);
          if (!url) continue;
          attachments.push({ id: `att_${Math.random().toString(16).slice(2)}`, title: title || "Enlace", url });
        }
      }
      if (!date) continue;
      expenses.push({ id, date, label, amount, currency, categoryId, notes, tags, attachments, confirmed });
    }
  }

  const incomeAdhoc: IncomeAdhocRow[] = [];
  const wsI = wb.getWorksheet(SH_INGRESOS);
  if (wsI) {
    const hr = findHeaderRow(wsI, ["fecha", "concepto"]) ?? 1;
    const h = rowVals(wsI.getRow(hr)).map((x) => x.trim());
    const iId = colIndex(h, "id");
    const iDate = colIndex(h, "fecha");
    const iLabel = colIndex(h, "concepto");
    const iAmt = colIndex(h, "importe");
    const iCur = colIndex(h, "moneda");
    const iCat = colIndex(h, "categoria_id");
    const iTags = colIndex(h, "etiquetas");
    const iAtt = colIndex(h, "adjuntos");
    const iNotes = colIndex(h, "notas");
    const iConf = colIndex(h, "confirmado");
    for (let r = hr + 1; r <= wsI.rowCount; r++) {
      const cells = rowVals(wsI.getRow(r));
      if (!cells.some((c) => c)) continue;
      const pick = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
      const id = pick(iId) || `xlsx_${Math.random().toString(16).slice(2)}`;
      const date = pick(iDate).slice(0, 10);
      const label = pick(iLabel) || "Ingreso";
      const amount = Number(pick(iAmt).replace(",", ".")) || 0;
      const currency = pick(iCur) === "USD" ? "USD" : "EUR";
      const categoryId = pick(iCat) || base.categories[0]!.id;
      const tags = parseTags(pick(iTags));
      const notes = pick(iNotes);
      const confCell = iConf >= 0 ? pick(iConf) : "";
      const confirmed = !/^no$/i.test(confCell);
      const attachments: ExpenseAttachment[] = [];
      const attCell = pick(iAtt);
      if (attCell) {
        for (const part of attCell.split(";")) {
          const p = part.trim();
          if (!p) continue;
          const pipe = p.indexOf("|");
          const title = pipe >= 0 ? p.slice(0, pipe).trim() : "Enlace";
          const urlRaw = pipe >= 0 ? p.slice(pipe + 1).trim() : p;
          const url = normalizeHttpsUrl(urlRaw);
          if (!url) continue;
          attachments.push({ id: `att_${Math.random().toString(16).slice(2)}`, title: title || "Enlace", url });
        }
      }
      if (!date) continue;
      incomeAdhoc.push({ id, date, label, amount, currency, categoryId, notes, tags, attachments, confirmed });
    }
  }

  const subscriptions: SubscriptionRow[] = [];
  const wsS = wb.getWorksheet(SH_SUBS);
  if (wsS) {
    const hr = findHeaderRow(wsS, ["nombre", "importe"]) ?? 1;
    const h = rowVals(wsS.getRow(hr)).map((x) => x.trim());
    const pick = (cells: string[], name: string) => {
      const i = colIndex(h, name);
      return i >= 0 ? (cells[i] ?? "").trim() : "";
    };
    for (let r = hr + 1; r <= wsS.rowCount; r++) {
      const cells = rowVals(wsS.getRow(r));
      if (!cells.some((c) => c)) continue;
      const id = pick(cells, "id") || `xlsx_${Math.random().toString(16).slice(2)}`;
      const name = pick(cells, "nombre") || "Suscripción";
      const amount = Number(pick(cells, "importe").replace(",", ".")) || 0;
      const currency = pick(cells, "moneda") === "USD" ? "USD" : "EUR";
      const cycleRaw = pick(cells, "ciclo");
      const cycle = (["weekly", "monthly", "quarterly", "yearly"] as const).includes(cycleRaw as any)
        ? (cycleRaw as SubscriptionRow["cycle"])
        : "monthly";
      const categoryId = pick(cells, "categoria_id") || base.categories[0]!.id;
      const nextBilling = pick(cells, "proximo_cargo").slice(0, 10);
      const billingRaw = pick(cells, "fecha_inicio").slice(0, 10);
      const active = !/^no$/i.test(pick(cells, "activa"));
      const tags = parseTags(pick(cells, "etiquetas"));
      const notes = pick(cells, "notas");
      if (!name) continue;
      const billingStartDate = billingRaw.length === 10 ? billingRaw : undefined;
      const row: SubscriptionRow = {
        id,
        name,
        amount,
        currency,
        cycle,
        categoryId,
        billingStartDate,
        nextBilling,
        active,
        notes,
        tags,
      };
      row.nextBilling = subscriptionNextChargeIso(row);
      subscriptions.push(row);
    }
  }

  const reminders: ExpenseReminder[] = [];
  const wsR = wb.getWorksheet(SH_REM);
  if (wsR) {
    const hr = findHeaderRow(wsR, ["fecha", "titulo"]) ?? 1;
    const h = rowVals(wsR.getRow(hr)).map((x) => x.trim());
    for (let r = hr + 1; r <= wsR.rowCount; r++) {
      const cells = rowVals(wsR.getRow(r));
      if (!cells.some((c) => c)) continue;
      const pick = (name: string) => {
        const i = colIndex(h, name);
        return i >= 0 ? (cells[i] ?? "").trim() : "";
      };
      const id = pick("id") || `xlsx_${Math.random().toString(16).slice(2)}`;
      const title = pick("titulo") || "Recordatorio";
      const date = pick("fecha").slice(0, 10);
      const note = pick("nota");
      const notifyBrowser = /^si$/i.test(pick("notificar"));
      const expenseId = pick("gasto_id") || undefined;
      if (!date) continue;
      reminders.push({ id, title, date, note, notifyBrowser, expenseId });
    }
  }

  const tagBank: string[] = [];
  const wsT = wb.getWorksheet(SH_TAGS);
  if (wsT) {
    for (let r = 2; r <= wsT.rowCount; r++) {
      const v = String(wsT.getRow(r).getCell(1).value ?? "").trim();
      if (v) tagBank.push(v.toLowerCase());
    }
  }

  const paychecks: PaycheckEntry[] = [];
  const wsP = wb.getWorksheet(SH_PAY);
  if (wsP) {
    const hr = findHeaderRow(wsP, ["titulo", "dia"]) ?? 1;
    const h = rowVals(wsP.getRow(hr)).map((x) => x.trim());
    const pickP = (cells: string[], name: string) => {
      const i = colIndex(h, name);
      return i >= 0 ? (cells[i] ?? "").trim() : "";
    };
    for (let r = hr + 1; r <= wsP.rowCount; r++) {
      const cells = rowVals(wsP.getRow(r));
      if (!cells.some((c) => c)) continue;
      const id = pickP(cells, "id") || `xlsx_${Math.random().toString(16).slice(2)}`;
      const title = pickP(cells, "titulo") || "Cobro";
      const day = Number(pickP(cells, "dia_mes")) || 1;
      const dayOfMonth = Math.min(31, Math.max(1, Math.floor(day)));
      const wCell = pickP(cells, "ventana_antes");
      let windowBefore: number | undefined;
      if (wCell) {
        const w = Number(wCell);
        if (Number.isFinite(w)) windowBefore = Math.min(15, Math.max(0, Math.floor(w)));
      }
      const note = pickP(cells, "nota");
      paychecks.push({ id, title, dayOfMonth, windowBefore, note: note || undefined });
    }
  }

  return normalizeExpenseTrackerState({
    v: 2,
    categories: base.categories,
    expenses,
    subscriptions,
    reminders,
    tagBank: [...new Set(tagBank)],
    syncToAccount: false,
    chartMoneyMode,
    eurPerUsd,
    period,
    chartFilterCategoryId,
    paychecks,
    incomeAdhoc,
  });
}
