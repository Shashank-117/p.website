// --- Set your Lambda URL here ---
const LAMBDA_URL = "https://vus6woiowc.execute-api.us-east-1.amazonaws.com/default/NewsSentimentAnalysis";

// Elements
const countryEl = document.getElementById("country");
const searchEl  = document.getElementById("search");
const fetchBtn  = document.getElementById("fetchBtn");
const grid      = document.getElementById("grid");
const statusEl  = document.getElementById("status");
const cardTpl   = document.getElementById("cardTpl");

// Local cache to reduce flicker
const cache = new Map();

function setStatus(msg, isError=false){
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "var(--neg)" : "var(--muted)";
}

function classify(compound){
  if (compound >  0.2) return "POSITIVE";
  if (compound < -0.2) return "NEGATIVE";
  return "NEUTRAL";
}
function widthFromCompound(c){ return Math.round(Math.abs(c) * 50); }
function fmtDate(iso){
  try{
    return new Intl.DateTimeFormat(undefined, {
      year:"numeric", month:"short", day:"2-digit",
      hour:"2-digit", minute:"2-digit"
    }).format(new Date(iso));
  }catch{ return iso ?? ""; }
}

function render(articles){
  grid.innerHTML = "";
  if(!Array.isArray(articles) || articles.length===0){
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No articles found.";
    grid.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  for(const a of articles){
    const node = cardTpl.content.firstElementChild.cloneNode(true);
    const title = node.querySelector(".title");
    title.textContent = a.title || "(no title)";
    title.href = a.url || "#";

    node.querySelector(".source").textContent = a.source || "Unknown source";
    node.querySelector(".date").textContent = fmtDate(a.publishedAt);

    const compound = Number(a?.vader?.compound ?? 0);
    const sentiment = classify(compound);
    const badge = node.querySelector(".badge.sentiment");
    badge.textContent = sentiment;
    badge.classList.add(sentiment);

    const fill = node.querySelector(".meter-fill");
    const w = widthFromCompound(compound);
    fill.style.width = `${w}%`;
    fill.style.left = "50%";
    fill.style.transform = compound >= 0 ? "translateX(0)" : "translateX(-100%)";
    fill.style.backgroundColor =
      compound > 0.2 ? "var(--pos)" :
      compound < -0.2 ? "var(--neg)" : "var(--neu)";
    node.querySelector(".meter-val").textContent = compound.toFixed(3);

    const dl = node.querySelector(".distil-label");
    const ds = node.querySelector(".distil-score");
    dl.textContent = a?.distilbert?.label ?? "PENDING";
    const score = a?.distilbert?.score;
    ds.textContent = (score !== null && score !== undefined) ? `(${Number(score).toFixed(3)})` : "";

    frag.appendChild(node);
  }
  grid.appendChild(frag);
}

function key(country, search){
  return JSON.stringify({country, search});
}

async function fetchArticles(){
  const country = countryEl.value;
  let search = searchEl.value.trim();

  // Build request body (POST JSON)
  const body = {};
  if (search){
    // Convert commas to " | " unless already contains pipe
    if (search.includes(",") && !search.includes("|")){
      search = search.split(",").map(s=>s.trim()).filter(Boolean).join(" | ");
    }
    body.search = search;
  } else {
    body.country = country;
  }

  const ck = key(country, search || "");
  if (cache.has(ck)){
    const cached = cache.get(ck);
    render(cached);
    setStatus(`Loaded ${cached.length} cached article(s).`);
    return;
  }

  setStatus("Fetching articles…");
  fetchBtn.disabled = true;

  try{
    const res = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body),
    });

    if(!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    const articles = payload?.articles ?? [];
    cache.set(ck, articles);
    render(articles);
    setStatus(`Showing ${articles.length} article(s).`);
  }catch(err){
    setStatus(`Failed to fetch: ${err.message}`, true);
  }finally{
    fetchBtn.disabled = false;
  }
}

// UX sugar: Enter in search triggers fetch
searchEl.addEventListener("keydown", (e)=>{
  if(e.key==="Enter"){ fetchArticles(); }
});
fetchBtn.addEventListener("click", fetchArticles);

// Initial load (country=us)
window.addEventListener("DOMContentLoaded", fetchArticles);
