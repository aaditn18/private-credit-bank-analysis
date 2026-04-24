"""Static bank registry — kept dependency-free so it can be imported from
the agent layer without dragging in DB / HTTP modules.

``rssd_id`` is the FFIEC Call Report filer ID (bank subsidiary, not holding
company). This matches the IDRSSD column in FFIEC bulk CSV downloads.
"""

from __future__ import annotations


BANK_REGISTRY: dict[str, dict[str, str | None]] = {
    # G-SIBs
    "JPM": {"name": "JPMorgan Chase & Co.",              "rssd_id": "852218",  "cik": "0000019617", "peer_group": "GSIB"},
    "BAC": {"name": "Bank of America Corporation",       "rssd_id": "480228",  "cik": "0000070858", "peer_group": "GSIB"},
    "C":   {"name": "Citigroup Inc.",                    "rssd_id": "476810",  "cik": "0000831001", "peer_group": "GSIB"},
    "WFC": {"name": "Wells Fargo & Company",             "rssd_id": "451965",  "cik": "0000072971", "peer_group": "GSIB"},
    # Trust / IB
    "GS":  {"name": "The Goldman Sachs Group",           "rssd_id": "2182786", "cik": "0000886982", "peer_group": "trust-ib"},
    "MS":  {"name": "Morgan Stanley",                    "rssd_id": "1456501", "cik": "0000895421", "peer_group": "trust-ib"},
    "BK":  {"name": "The Bank of New York Mellon",       "rssd_id": "541101",  "cik": "0001390777", "peer_group": "trust-ib"},
    "STT": {"name": "State Street Corporation",          "rssd_id": "35301",   "cik": "0000093751", "peer_group": "trust-ib"},
    "NTRS":{"name": "Northern Trust Corporation",        "rssd_id": "210434",  "cik": "0000073309", "peer_group": "trust-ib"},
    "RJF": {"name": "Raymond James Financial",           "rssd_id": "2193616", "cik": "0000720005", "peer_group": "trust-ib"},
    "SCHW":{"name": "The Charles Schwab Corporation",    "rssd_id": "3150447", "cik": "0000316709", "peer_group": "trust-ib"},
    # Super-regionals
    "USB": {"name": "U.S. Bancorp",                      "rssd_id": "504713",  "cik": "0000036104", "peer_group": "regional"},
    "PNC": {"name": "The PNC Financial Services Group",  "rssd_id": "817824",  "cik": "0000713676", "peer_group": "regional"},
    "TFC": {"name": "Truist Financial",                  "rssd_id": "852320",  "cik": "0000092230", "peer_group": "regional"},
    "COF": {"name": "Capital One Financial",             "rssd_id": "112837",  "cik": "0000927628", "peer_group": "regional"},
    "AXP": {"name": "American Express Company",          "rssd_id": "1394676", "cik": "0000004962", "peer_group": "regional"},
    "MTB": {"name": "M&T Bank Corporation",              "rssd_id": "501105",  "cik": "0000036270", "peer_group": "regional"},
    "RF":  {"name": "Regions Financial Corporation",     "rssd_id": "233031",  "cik": "0001281761", "peer_group": "regional"},
    "CFG": {"name": "Citizens Financial Group",          "rssd_id": "3303298", "cik": "0001536520", "peer_group": "regional"},
    "HBAN":{"name": "Huntington Bancshares",             "rssd_id": "12311",   "cik": "0000049196", "peer_group": "regional"},
    "FITB":{"name": "Fifth Third Bancorp",               "rssd_id": "723112",  "cik": "0000035527", "peer_group": "regional"},
    "KEY": {"name": "KeyCorp",                           "rssd_id": "280110",  "cik": "0000091576", "peer_group": "regional"},
    "ALLY":{"name": "Ally Financial Inc.",               "rssd_id": "3284070", "cik": "0000040729", "peer_group": "regional"},
    "SYF": {"name": "Synchrony Financial",               "rssd_id": "1216022", "cik": "0001601712", "peer_group": "regional"},
    "DFS": {"name": "Discover Financial Services",       "rssd_id": "30810",   "cik": "0001393612", "peer_group": "regional"},
    "SOFI":{"name": "SoFi Technologies",                 "rssd_id": "962966",  "cik": "0001818874", "peer_group": "regional"},
    # Mid-size regionals
    "FHN": {"name": "First Horizon Corporation",         "rssd_id": "485559",  "cik": "0000036966", "peer_group": "regional"},
    "FLG": {"name": "Flagstar Financial",                "rssd_id": "694904",  "cik": "0001025608", "peer_group": "regional"},
    "CMA": {"name": "Comerica Incorporated",             "rssd_id": "60143",   "cik": "0000028412", "peer_group": "regional"},
    "ZION":{"name": "Zions Bancorporation",              "rssd_id": "276579",  "cik": "0000109380", "peer_group": "regional"},
    "SNV": {"name": "Synovus Financial Corp.",           "rssd_id": "395238",  "cik": "0000018349", "peer_group": "regional"},
    "CFR": {"name": "Cullen/Frost Bankers",              "rssd_id": "682563",  "cik": "0000030697", "peer_group": "regional"},
    "WAL": {"name": "Western Alliance Bancorporation",   "rssd_id": "3138146", "cik": "0001212545", "peer_group": "regional"},
    "EWBC":{"name": "East West Bancorp",                 "rssd_id": "197478",  "cik": "0000806985", "peer_group": "regional"},
    "WTFC":{"name": "Wintrust Financial Corporation",    "rssd_id": "2239288", "cik": "0001015328", "peer_group": "regional"},
    "PNFP":{"name": "Pinnacle Financial Partners",       "rssd_id": "2925666", "cik": "0001115012", "peer_group": "regional"},
    "UMBF":{"name": "UMB Financial Corporation",         "rssd_id": "936855",  "cik": "0000101830", "peer_group": "regional"},
    "BOKF":{"name": "BOK Financial Corporation",         "rssd_id": "339858",  "cik": "0000875357", "peer_group": "regional"},
    "WBS": {"name": "Webster Financial Corporation",     "rssd_id": "761806",  "cik": "0000801337", "peer_group": "regional"},
    "FCNCA":{"name":"First Citizens BancShares",         "rssd_id": "491224",  "cik": "0000798941", "peer_group": "regional"},
    "VLY": {"name": "Valley National Bancorp",           "rssd_id": "229801",  "cik": "0000074260", "peer_group": "regional"},
    "COLB":{"name": "Columbia Banking System",           "rssd_id": "143662",  "cik": "0000798941", "peer_group": "regional"},
    "ASB": {"name": "Associated Banc-Corp",              "rssd_id": "917742",  "cik": "0000835324", "peer_group": "regional"},
    "FNB": {"name": "F.N.B. Corporation",                "rssd_id": "379920",  "cik": "0000037808", "peer_group": "regional"},
    "ONB": {"name": "Old National Bancorp",              "rssd_id": "208244",  "cik": "0000070858", "peer_group": "regional"},
    "BPOP":{"name": "Popular, Inc.",                     "rssd_id": "940311",  "cik": "0000763901", "peer_group": "regional"},
    "BKU": {"name": "BankUnited, Inc.",                  "rssd_id": "3938186", "cik": "0001504776", "peer_group": "regional"},
    "PB":  {"name": "Prosperity Bancshares",             "rssd_id": "664756",  "cik": "0001077428", "peer_group": "regional"},
    "SSB": {"name": "SouthState Corporation",            "rssd_id": "1929247", "cik": "0000764180", "peer_group": "regional"},
    "SF":  {"name": "Stifel Financial Corp.",            "rssd_id": "3076220", "cik": "0000895655", "peer_group": "regional"},
}
