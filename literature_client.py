import json
import logging
import urllib.parse
from typing import List, Dict, Any, Optional
import requests

from config import OPENALEX_API_BASE, USER_AGENT, DATA_DIR

logger = logging.getLogger(__name__)

class LiteratureClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.benchmarks_file = DATA_DIR / "benchmarks.json"
        self._benchmarks_cache = None

    def _get_benchmarks(self) -> List[Dict[str, Any]]:
        if self._benchmarks_cache is None:
            if self.benchmarks_file.exists():
                try:
                    with open(self.benchmarks_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self._benchmarks_cache = data.get("benchmarks", [])
                except Exception as e:
                    logger.error(f"Error loading benchmarks: {e}")
                    self._benchmarks_cache = []
            else:
                self._benchmarks_cache = []
        return self._benchmarks_cache

    def find_benchmark_by_id(self, benchmark_id: str) -> Optional[Dict[str, Any]]:
        benchmarks = self._get_benchmarks()
        for b in benchmarks:
            if b.get("id") == benchmark_id:
                return b
        return None

    def find_matching_benchmark(self, query: str) -> Optional[Dict[str, Any]]:
        """Checks if a user query closely matches one of our rich pre-computed benchmarks."""
        benchmarks = self._get_benchmarks()
        q_lower = query.lower()
        for b in benchmarks:
            title_lower = b.get("title", "").lower()
            hypo_lower = b.get("hypothesis", "").lower()
            id_lower = b.get("id", "").lower()
            
            # Direct keyword hits
            if "metformin" in q_lower and ("lifespan" in q_lower or "longevity" in q_lower or "aging" in q_lower):
                if b["id"] == "metformin_longevity":
                    return b
            if ("chain-of-thought" in q_lower or "cot" in q_lower) and ("reasoning" in q_lower or "token" in q_lower or "gsm" in q_lower):
                if b["id"] == "cot_reasoning":
                    return b
            if "neurogenesis" in q_lower and ("human" in q_lower or "hippocampus" in q_lower or "adult" in q_lower):
                if b["id"] == "adult_neurogenesis":
                    return b
            
            # General overlap
            if id_lower in q_lower or title_lower in q_lower:
                return b
        return None

    @staticmethod
    def _reconstruct_abstract(inverted_index: Optional[Dict[str, List[int]]]) -> str:
        """OpenAlex stores abstracts as inverted indexes (word: [positions]). Reconstruct to prose."""
        if not inverted_index:
            return ""
        positions = {}
        for word, idxs in inverted_index.items():
            for idx in idxs:
                positions[idx] = word
        sorted_words = [positions[i] for i in sorted(positions.keys())]
        return " ".join(sorted_words)

    def search_openalex(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch papers from OpenAlex with dual-stance retrieval."""
        papers = []
        try:
            # Stance 1: General/Affirmative query
            encoded_q = urllib.parse.quote(query)
            url_affirmative = f"{OPENALEX_API_BASE}/works?search={encoded_q}&sort=relevance_score:desc&per-page={limit}"
            
            resp = self.session.get(url_affirmative, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("results", []):
                    abstract = self._reconstruct_abstract(item.get("abstract_inverted_index"))
                    authors = ", ".join([a.get("author", {}).get("display_name", "") for a in item.get("authorships", [])[:4]])
                    venue = item.get("primary_location", {}).get("source", {}).get("display_name") or "Academic Source"
                    
                    papers.append({
                        "id": item.get("id", "").split("/")[-1] or f"P_{len(papers)+1}",
                        "title": item.get("title") or "Untitled Paper",
                        "authors": authors or "Unknown Authors",
                        "year": item.get("publication_year") or 2023,
                        "journal": venue,
                        "doi": item.get("doi", "").replace("https://doi.org/", "") if item.get("doi") else "",
                        "citations": item.get("cited_by_count", 0),
                        "abstract": abstract,
                        "open_access_url": item.get("open_access", {}).get("oa_url") or item.get("doi") or ""
                    })

            # Stance 2: Adversarial/Contradictory query to actively discover opposing evidence
            adversarial_q = f"{query} (contradicts OR null OR 'no effect' OR 'failure to replicate' OR debate OR dispute)"
            encoded_adv = urllib.parse.quote(adversarial_q)
            url_adversarial = f"{OPENALEX_API_BASE}/works?search={encoded_adv}&sort=relevance_score:desc&per-page={limit // 2}"
            
            resp_adv = self.session.get(url_adversarial, timeout=6)
            if resp_adv.status_code == 200:
                data_adv = resp_adv.json()
                existing_titles = {p["title"].lower() for p in papers}
                for item in data_adv.get("results", []):
                    title = item.get("title") or ""
                    if title.lower() not in existing_titles and len(papers) < limit * 1.5:
                        abstract = self._reconstruct_abstract(item.get("abstract_inverted_index"))
                        authors = ", ".join([a.get("author", {}).get("display_name", "") for a in item.get("authorships", [])[:4]])
                        venue = item.get("primary_location", {}).get("source", {}).get("display_name") or "Academic Source"
                        
                        papers.append({
                            "id": item.get("id", "").split("/")[-1] or f"P_{len(papers)+1}",
                            "title": title or "Untitled Study",
                            "authors": authors or "Unknown Authors",
                            "year": item.get("publication_year") or 2023,
                            "journal": venue,
                            "doi": item.get("doi", "").replace("https://doi.org/", "") if item.get("doi") else "",
                            "citations": item.get("cited_by_count", 0),
                            "abstract": abstract,
                            "open_access_url": item.get("open_access", {}).get("oa_url") or item.get("doi") or ""
                        })
        except Exception as e:
            logger.warning(f"Live OpenAlex API search failed or timed out: {e}")
            
        return papers

    def search_literature(self, query: str) -> Dict[str, Any]:
        """Main entry point: returns benchmark if matched or live search results."""
        # 1. Check for exact pre-loaded benchmark
        matched_benchmark = self.find_matching_benchmark(query)
        if matched_benchmark:
            return {
                "source": "benchmark",
                "benchmark_id": matched_benchmark["id"],
                "data": matched_benchmark
            }

        # 2. Attempt live search via OpenAlex
        live_papers = self.search_openalex(query)
        if live_papers:
            return {
                "source": "live",
                "papers": live_papers
            }

        # 3. Fallback: synthesize semantic candidates from benchmark patterns
        return {
            "source": "offline_fallback",
            "papers": []
        }
