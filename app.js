// --- Set your Lambda URL here ---
const LAMBDA_URL = "https://vus6woiowc.execute-api.us-east-1.amazonaws.com/default/NewsSentimentAnalysis";

// Elements
const countryEl = document.getElementById("country");
const searchEl  = document.getElementById("search");
const fetchBtn  = document.getElementById("fetchBtn");
const grid      = document.getElementById("grid");
const statusEl  = document.getElementById("status");
const cardTpl   = document.getElementById("cardTpl");

const cache = new Map();

function setStatus(msg, isError=false){
  statusEl.textContent = msg;
  statusEl.className = isError ? "status error" : "status";
}

function pct(v){ return Math.max(0, Math.min(100, Math.round(v*100))); }

function vaderPN(compound){
  const pos = (compound + 1) / 2;
  return { pos, neg: 1 - pos };
}

function bertPN(label, score){
  if (typeof score === "number") {
    const pos = score;
    return { pos, neg: 1 - pos };
  }
  const isPos = String(label||"").toUpperCase().includes("POS");
  const pos = isPos ? 0.9 : 0.1;
  return { pos, neg: 1 - pos };
}

function renderArticles(articles){
  grid.innerHTML = "";
  const frag = document.createDocumentFragment();

  for(const a of articles){
    const node = cardTpl.content.firstElementChild.cloneNode(true);
    const titleEl = node.querySelector(".title");
    if(titleEl){
      titleEl.textContent = a.title || "(no title)";
      if(a.url) titleEl.href = a.url;
    }
    node.querySelector(".source").textContent = a.source || "";
    node.querySelector(".time").textContent = a.publishedAt ? new Date(a.publishedAt).toLocaleString() : "";

    // VADER
    const compound = (a.vader && typeof a.vader.compound === "number") ? a.vader.compound : 0;
    const {pos: vPos, neg: vNeg} = vaderPN(compound);
    node.querySelector(".pos-fill").style.width = pct(vPos) + "%";
    node.querySelector(".neg-fill").style.width = pct(vNeg) + "%";
    node.querySelector(".meter-val").textContent = `P: ${pct(vPos)}% · N: ${pct(vNeg)}%`;

    // DistilBERT
    const dl = a.distilbert || {};
    const {pos: bPos, neg: bNeg} = bertPN(dl.label, dl.score);
    node.querySelector(".bert-pos").style.width = pct(bPos) + "%";
    node.querySelector(".bert-neg").style.width = pct(bNeg) + "%";
    node.querySelector(".bert-val").textContent =
      dl.label ? `P: ${pct(bPos)}% · N: ${pct(bNeg)}%` : "PENDING";

    frag.appendChild(node);
  }
  grid.appendChild(frag);
}

async function fetchArticles(){
  try{
    fetchBtn.disabled = true;
    setStatus("Loading...");
    const params = new URLSearchParams();
    const country = (countryEl?.value || "us").toLowerCase();
    if(country){ params.set("country", country); }
    const q = (searchEl?.value || "").trim();
    if(q){ params.set("search", q); }
    const cacheKey = params.toString();
    if(cache.has(cacheKey)){
      renderArticles(cache.get(cacheKey));
      setStatus("Cached");
      return;
    }
    const url = LAMBDA_URL + "?" + params.toString();
    const resp = await fetch(url, { mode: "cors" });
    if(!resp.ok){ throw new Error(`HTTP ${resp.status}`); }
    const data = await resp.json();
    const articles = data.articles || [];
    cache.set(cacheKey, articles);
    renderArticles(articles);
    setStatus(`Loaded ${articles.length} article(s).`);
  }catch(err){
    setStatus(`Failed: ${err.message}`, true);
  }finally{
    fetchBtn.disabled = false;
  }
}

searchEl.addEventListener("keydown", e=>{ if(e.key==="Enter"){ fetchArticles(); } });
fetchBtn.addEventListener("click", fetchArticles);
window.addEventListener("DOMContentLoaded", fetchArticles);
