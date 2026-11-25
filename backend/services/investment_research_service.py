import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.research import ResearchReport, WatchlistItem

logger = logging.getLogger(__name__)

PRECOMPUTED_RESEARCH_DOSSIERS = [
    {
        "symbol": "BTCUSDT",
        "name": "Bitcoin (BTC)",
        "asset_class": "crypto",
        "headline": "Digital Gold Macro Thesis: Post-Halving Supply Compression & Institutional Inflows",
        "investment_thesis": "Bitcoin serves as an algorithmic, decentralized reserve asset with a strictly capped 21 million supply limit. Post-halving daily emissions stand at ~450 BTC/day, contrasted against persistent structural accumulation from institutional Spot ETFs and sovereign wealth allocations.",
        "fundamental_metrics": {
            "circulating_supply": "19,780,000 BTC",
            "max_supply": "21,000,000 BTC",
            "stock_to_flow_ratio": 112.4,
            "hashrate_eh_s": 650.2,
            "active_addresses_24h": "920,000",
            "annual_inflation_rate": "0.85%"
        },
        "technical_bias": "Bullish",
        "bull_case": "Continued global sovereign debt debasement accelerates allocation by non-traditional institutional treasuries; supply shock from ETF absorption outweighs miner selling pressure, driving price expansion toward new macro cycle peaks.",
        "bear_case": "Macroeconomic liquidity contractions, aggressive Federal Reserve rate tightness, or regulatory headwinds concerning proof-of-work energy consumption could compress high-beta risk asset multiples.",
        "key_catalysts": [
            "Global liquidity (M2) expansion and sovereign monetary easing cycles",
            "Expansion of options trading on institutional Spot Bitcoin ETFs",
            "Adoption by sovereign wealth funds and corporate balance sheets"
        ],
        "major_risks": [
            "Regulatory classification changes in key G20 jurisdictions",
            "Macro liquidity contraction and risk-off contagion in broader equities",
            "Exchange-traded fund outflow streaks during persistent market drawdowns"
        ],
        "sources": [
            {"title": "Bitcoin Whitepaper - Satoshi Nakamoto", "source": "Bitcoin.org", "date": "2008-10-31"},
            {"title": "SEC Spot Bitcoin ETP Approvals", "source": "SEC.gov", "date": "2024-01-10"},
            {"title": "Cambridge Bitcoin Electricity Consumption Index", "source": "Cambridge Centre for Alternative Finance", "date": "2024-08-15"}
        ],
        "confidence_score": 0.88,
        "time_horizon": "Long-term (12-36 months)"
    },
    {
        "symbol": "GC=F",
        "name": "Gold Futures / Physical Gold (XAU)",
        "asset_class": "commodity",
        "headline": "Sovereign Central Bank De-Dollarization & Geopolitical Safe-Haven Hegemony",
        "investment_thesis": "Gold remains the premier zero-counterparty risk monetary reserve asset. Central banks (notably PBOC, RBI, and emerging market monetary authorities) have purchased physical bullion at record-breaking annualized rates to diversify foreign exchange reserves away from USD concentration.",
        "fundamental_metrics": {
            "above_ground_stocks_tonnes": 212582,
            "central_bank_net_purchases_2024_t": 1037,
            "real_yield_correlation": -0.68,
            "mine_production_growth_annual": "1.2%"
        },
        "technical_bias": "Bullish",
        "bull_case": "Persistent geopolitical fragmentation, weaponization of dollar-clearing systems, and rising Western sovereign debt-to-GDP ratios spur multi-year central bank accumulation and institutional re-allocation.",
        "bear_case": "Sustained positive real interest rates in US Treasuries and unexpected cessation of geopolitical conflicts reduce non-yielding safe-haven appeal.",
        "key_catalysts": [
            "Central bank reserve diversification mandates (RBI & PBOC bullion reserves)",
            "Federal Reserve rate cuts lowering opportunity cost of holding non-yielding assets",
            "Escalation of global tariff regimes and currency friction"
        ],
        "major_risks": [
            "Prolonged 'higher for longer' real Treasury yields",
            "IMF or European central bank opportunistic reserve disposals"
        ],
        "sources": [
            {"title": "World Gold Council Central Bank Gold Reserves Survey", "source": "Gold.org", "date": "2024-06-18"},
            {"title": "Reserve Bank of India Foreign Exchange Management Bulletins", "source": "rbi.org.in", "date": "2024-09-01"}
        ],
        "confidence_score": 0.85,
        "time_horizon": "Medium to Long-term (6-24 months)"
    },
    {
        "symbol": "RELIANCE.NS",
        "name": "Reliance Industries Limited (NSE)",
        "asset_class": "equity",
        "headline": "Digital Conglomerate Transition: Jio 5G Monetization & New Energy Capex",
        "investment_thesis": "Reliance Industries represents India's largest market capitalization company, transforming from legacy petrochemical refining into a consumer-tech juggernaut (Jio Infocomm + Reliance Retail) and an integrated green hydrogen/solar gigafactory ecosystem.",
        "fundamental_metrics": {
            "market_cap_inr": "₹19.8 Lakh Cr",
            "pe_ratio": 26.4,
            "ev_ebitda": 13.8,
            "telecom_subscribers": "488 Million",
            "retail_stores_count": 18836
        },
        "technical_bias": "Neutral to Bullish",
        "bull_case": "Upcoming de-merger and separate IPO listings of Jio and Reliance Retail unlock substantial sum-of-the-parts (SOTP) valuation premiums; tariff hikes in telecom immediately expand ARPU and free cash flow.",
        "bear_case": "Volatile gross refining margins (GRMs) in O2C petrochemical segment and high capital expenditure intensity in green energy delay near-term ROCE expansion.",
        "key_catalysts": [
            "Potential value-unlocking IPO filing for Jio Telecom & Retail divisions",
            "Quarterly Average Revenue Per User (ARPU) expansion above ₹200",
            "Commercial commissioning of Dhirubhai Ambani Green Energy Giga Complex in Jamnagar"
        ],
        "major_risks": [
            "Global crude oil volatility affecting downstream refining spreads",
            "Heightened regulatory scrutiny on Indian telecom tariff pricing"
        ],
        "sources": [
            {"title": "RIL Annual Financial Statements & Investor Presentation", "source": "bseindia.com", "date": "2024-07-20"},
            {"title": "TRAI Telecom Subscription Data Reports", "source": "trai.gov.in", "date": "2024-08-30"}
        ],
        "confidence_score": 0.82,
        "time_horizon": "Long-term (12-36 months)"
    },
    {
        "symbol": "^NSEI",
        "name": "NIFTY 50 Index (NSE India)",
        "asset_class": "equity",
        "headline": "India Demographic Dividend & Structural Domestic SIP Capital Flow Dominance",
        "investment_thesis": "The benchmark index of India's top 50 corporate leaders. India remains the fastest-growing major global economy (6.5-7.0% GDP expansion). The market structure is underpinned by unprecedented domestic retail mutual fund SIP inflows (~₹23,000+ Crore monthly) creating an impervious domestic liquidity buffer.",
        "fundamental_metrics": {
            "pe_ratio": 22.8,
            "pb_ratio": 3.9,
            "dividend_yield_pct": 1.25,
            "monthly_sip_inflow_inr": "₹23,547 Cr",
            "index_eps_growth_yoy": "14.2%"
        },
        "technical_bias": "Bullish",
        "bull_case": "Corporate earnings growth compounds at 12-15% CAGR; strong domestic credit cycle and sovereign manufacturing incentives (PLI schemes) draw sustained global FII rebalancing.",
        "bear_case": "Elevated mid-cap valuations and global geopolitical shocks prompt temporary FII profit-taking; rural consumption slowdown dampens FMCG component earnings.",
        "key_catalysts": [
            "RBI monetary easing cycle kickoff supporting bank credit growth",
            "Record government infrastructure capital expenditure allocations",
            "Inclusion of Indian government bonds into global emerging market indices"
        ],
        "major_risks": [
            "Monsoon volatility impacting rural discretionary demand",
            "Global crude oil spikes degrading India's current account deficit"
        ],
        "sources": [
            {"title": "National Stock Exchange Index Factsheets", "source": "nseindia.com", "date": "2024-09-30"},
            {"title": "AMFI Monthly Mutual Fund Data Disclosures", "source": "amfiindia.com", "date": "2024-10-10"}
        ],
        "confidence_score": 0.86,
        "time_horizon": "Core Allocation (3-5 years)"
    }
]

class InvestmentResearchService:
    """Delivers verifiable, fundamental and institutional investment research dossiers."""

    @staticmethod
    def initialize_research_data(db: Session):
        """Seed pre-computed institutional dossiers into database."""
        for item in PRECOMPUTED_RESEARCH_DOSSIERS:
            existing = db.query(ResearchReport).filter(ResearchReport.symbol == item["symbol"]).first()
            if not existing:
                report = ResearchReport(**item)
                db.add(report)
        
        # Seed default watchlists
        default_watchlist = [
            {"symbol": "BTCUSDT", "name": "Bitcoin", "asset_class": "crypto", "target_entry_price": 60500.0, "target_exit_price": 75000.0, "notes": "Core crypto reserve asset"},
            {"symbol": "ETHUSDT", "name": "Ethereum", "asset_class": "crypto", "target_entry_price": 2400.0, "target_exit_price": 3200.0, "notes": "Smart contract settlement layer"},
            {"symbol": "GC=F", "name": "Gold Futures", "asset_class": "commodity", "target_entry_price": 2600.0, "target_exit_price": 2900.0, "notes": "Macro de-dollarization safe haven"},
            {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "asset_class": "equity", "target_entry_price": 1250.0, "target_exit_price": 1600.0, "notes": "India conglomerate SOTP unlock"},
            {"symbol": "^NSEI", "name": "NIFTY 50", "asset_class": "equity", "target_entry_price": 24200.0, "target_exit_price": 26500.0, "notes": "India growth engine benchmark"}
        ]
        for w in default_watchlist:
            existing_w = db.query(WatchlistItem).filter(WatchlistItem.symbol == w["symbol"]).first()
            if not existing_w:
                db.add(WatchlistItem(**w))

        db.commit()

    @staticmethod
    def get_all_reports(db: Session) -> List[Dict[str, Any]]:
        reports = db.query(ResearchReport).all()
        return [
            {
                "id": r.id,
                "symbol": r.symbol,
                "name": r.name,
                "asset_class": r.asset_class,
                "headline": r.headline,
                "investment_thesis": r.investment_thesis,
                "fundamental_metrics": r.fundamental_metrics,
                "technical_bias": r.technical_bias,
                "bull_case": r.bull_case,
                "bear_case": r.bear_case,
                "key_catalysts": r.key_catalysts,
                "major_risks": r.major_risks,
                "sources": r.sources,
                "confidence_score": r.confidence_score,
                "time_horizon": r.time_horizon,
                "created_at": r.created_at.isoformat()
            }
            for r in reports
        ]

    @staticmethod
    def get_watchlist(db: Session) -> List[Dict[str, Any]]:
        items = db.query(WatchlistItem).all()
        return [
            {
                "id": w.id,
                "symbol": w.symbol,
                "name": w.name,
                "asset_class": w.asset_class,
                "target_entry_price": w.target_entry_price,
                "target_exit_price": w.target_exit_price,
                "notes": w.notes,
                "is_favorite": w.is_favorite
            }
            for w in items
        ]

    @staticmethod
    def add_to_watchlist(data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        item = WatchlistItem(
            symbol=data["symbol"],
            name=data.get("name", data["symbol"]),
            asset_class=data.get("asset_class", "crypto"),
            target_entry_price=data.get("target_entry_price"),
            target_exit_price=data.get("target_exit_price"),
            notes=data.get("notes", "")
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return {"success": True, "id": item.id}

investment_research_service = InvestmentResearchService()
