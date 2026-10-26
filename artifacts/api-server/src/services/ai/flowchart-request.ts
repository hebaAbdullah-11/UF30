/**
 * A per-turn opt-in. Past requests, mentions, questions ABOUT diagrams, and
 * quoted examples cannot switch diagrams on for subsequent ordinary replies.
 */
export function explicitlyRequestsFlowchart(message: string): boolean {
  const text = message.toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/gu, "")
    .replace(/[أإآ]/gu, "ا")
    .replace(/```[\s\S]*?```|`[^`]*`|“[^”]*”|"[^"]*"/gu, "")
    .replace(/(^|\s)'[^'\n]+'(?=\s|[.!?]|$)/gu, "$1");
  const clauses = text.split(/[.!?؟;\n،,]|\bbut\b|\binstead\b/gu);
  return clauses.some((clause) => {
    if (/\b(?:don['’]?t|do not|never|no need|avoid|stop|skip|not asking|not request|not want)\b/u.test(clause) ||
      /\bwithout\s+(?:(?:a|the|any)\s+)?(?:flow\s*charts?|diagrams?|visuali[sz]ation)\b/u.test(clause) ||
      /(?:^|\s)(?:لا|لاترسم|لاتعرض|لاتسوي|مابي|ماابي)(?:\s|$)|ما\s+(?:ابي|ابغى|احتاج)|مو\s+(?:طالب|ابي|ابغى)|(?:بدون|دون)\s+(?:اي\s+)?(?:مخطط|رسم|خريطة)/u.test(clause)) return false;
    // A request verb followed by a diagram object, not "show me WHY flowcharts..."
    const chart = "(?:flow\\s*charts?|diagrams?|decision\\s+trees?|process\\s+maps?)";
    const modifiers = "(?:\\s+(?:me|us|a|an|the|this|that|it|please|simple|detailed|clear|basic|complete|mermaid|visual|as|in|into|of|my|our|its|with)){0,9}\\s+";
    if (new RegExp(`\\b(?:show|draw|create|generate|make|build|provide|add|render|display|give|get)${modifiers}${chart}\\b`, "u").test(clause)) return true;
    if (new RegExp(`\\b(?:i\\s+(?:want|need|would like)|i['’]d\\s+like)${modifiers}${chart}\\b`, "u").test(clause)) return true;
    if (new RegExp(`\\b(?:(?:can|could|may)\\s+(?:i|we)|i['’]d\\s+like\\s+to)\\s+(?:see|view)${modifiers}${chart}\\b`, "u").test(clause)) return true;
    if (new RegExp(`\\b(?:turn|convert|represent|illustrate|map)\\s+(?:this|that|it|the process|the answer|the results|these steps)\\s+(?:as|into|with|using)\\s+(?:a\\s+)?${chart}\\b`, "u").test(clause)) return true;
    if (new RegExp(`\\b(?:show|draw|illustrate|visuali[sz]e)\\b.{0,100}\\b(?:as|using|with)\\s+(?:a\\s+)?${chart}\\b`, "u").test(clause)) return true;
    if (/\b(?:visuali[sz]e|diagram)\s+(?:this|that|it|the\s+(?:process|workflow|steps|answer|results)|these\s+(?:steps|results))\b/u.test(clause)) return true;
    if (/\bvisuali[sz]e\s+(?!why\b|what\b).{0,80}\b(?:process|workflow|steps|results|answer)\b/u.test(clause)) return true;
    if (/\bmap\s+(?:out\s+(?:this|that|the)\s+(?:process|workflow|steps)|(?:this|that|it)\s+out)\b/u.test(clause)) return true;
    if (/^\s*(?:a\s+)?(?:mermaid\s+)?(?:flow\s*chart|diagram|decision tree)(?:\s+please)?\s*$/u.test(clause)) return true;
    if (/(?:ارسم|اعرض|انشئ|اصنع|اعمل|وريني|ورني|عايز|بدي|سوي?|ابي|ابغى|اريد|حول|وضح|مثل)\s+(?:(?!ما هو|ما هي|ليش|لماذا|كيف)[^.!?؟]){0,65}(?:مخطط|خريطة تدفق|رسم توضيحي)/u.test(clause)) return true;
    return /(?:ارسمها|ارسمه|وضحها بصريا|وضح العملية بصريا|مثلها بصريا|حولها لمخطط|حول هذا الى مخطط)/u.test(clause);
  });
}

/** Defense in depth: diagrams are data, never instructions, links or executable HTML. */
export function safeFlowchartSource(value: unknown): string {
  if (typeof value !== "string") throw new Error("Missing Mermaid flowchart.");
  const source = value.trim().replace(/^```(?:mermaid)?\s*\n/i, "").replace(/\n```\s*$/, "").trim();
  if (!source || source.length > 8000 || !/^(?:flowchart|graph)\s+(?:TD|TB|LR|RL|BT)\b/u.test(source) ||
    /%%|<|>|(?:javascript|data|https?):/iu.test(source.replace(/-->|==>|-.->|<-->|<--|---/gu, "")) ||
    /(?:^|[\n;])\s*(?:click|href|callback|call|classDef|linkStyle|style)\b/imu.test(source)) {
    throw new Error("The generated flowchart contains unsupported or unsafe Mermaid syntax.");
  }
  return source;
}
