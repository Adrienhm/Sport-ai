import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { toSportKey } from "../services/sports";

const trendPoints = [12, 18, 15, 22, 28, 24, 30];
const xgTrend = [0.9, 1.4, 1.1, 1.7, 2.2, 1.8, 2.0];

const heatmapPattern = [
  1, 1, 2, 3, 4, 3, 2, 2, 3, 4, 3, 2,
  1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 3,
  1, 2, 2, 3, 4, 3, 2, 2, 3, 4, 3, 2,
  1, 1, 2, 2, 3, 2, 1, 1, 2, 2, 2, 1,
  1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 1,
];

function Dashboard({ sport = "Football" }) {
  const sportKey = toSportKey(sport);
  const [matches, setMatches] = useState([]);
  const [animateHeat, setAnimateHeat] = useState(true);
  const [reportStatus, setReportStatus] = useState("");
  const [reporting, setReporting] = useState(false);

  const isFootball = sport === "Football";

  useEffect(() => {
    api
      .get("/matches", { params: { sport: sportKey } })
      .then((res) => setMatches(res.data))
      .catch(() => setMatches([]));
  }, [sportKey]);

  const stats = useMemo(() => {
    if (!matches.length) {
      return {
        total: 0,
        avgGoals: 0,
        homeWinRate: 0,
        volatility: 0,
      };
    }

    const totalGoals = matches.reduce(
      (sum, m) => sum + (Number(m.scoreA) || 0) + (Number(m.scoreB) || 0),
      0
    );
    const homeWins = matches.filter((m) => Number(m.scoreA) > Number(m.scoreB)).length;
    const draws = matches.filter((m) => Number(m.scoreA) === Number(m.scoreB)).length;

    return {
      total: matches.length,
      avgGoals: (totalGoals / matches.length).toFixed(2),
      homeWinRate: ((homeWins / matches.length) * 100).toFixed(1),
      volatility: ((draws / matches.length) * 100).toFixed(1),
    };
  }, [matches]);

  const generatePdfReport = async () => {
    setReporting(true);
    try {
      const res = await api.get("/report/pdf", { params: { sport: sportKey }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sport-ai-${sport.toLowerCase()}-rapport-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setReportStatus("Rapport PDF genere et telecharge.");
    } catch {
      setReportStatus("Impossible de generer le rapport PDF.");
    } finally {
      setReporting(false);
    }
  };

  const heatCells = isFootball ? heatmapPattern : heatmapPattern.slice(0, 40);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Tableau de bord</p>
          <h1>Suivi temps reel des performances</h1>
          <p className="lead">
            Synthese IA des tendances, formes d'equipe et alertes de risque multi-sports.
          </p>
        </div>
        <div className="button-group">
          <button
            className="button primary icon-button"
            onClick={generatePdfReport}
            disabled={reporting}
            title="Generer le rapport PDF"
            aria-label="Generer le rapport PDF"
          >
            {reporting ? (
              "..."
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM13 3v5h5" />
                <path d="M8 14h8M8 17h6M8 11h3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {reportStatus ? <p className="hint">{reportStatus}</p> : null}

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Matchs analyses</p>
          <strong>{stats.total}</strong>
          <span>Sur la periode recente</span>
        </article>
        <article className="kpi-card">
          <p>{isFootball ? "Moyenne de buts" : "Points moyens"}</p>
          <strong>{stats.avgGoals}</strong>
          <span>Par rencontre</span>
        </article>
        <article className="kpi-card">
          <p>Victoire equipe A</p>
          <strong>{stats.homeWinRate}%</strong>
          <span>Impact domicile/terrain</span>
        </article>
        <article className="kpi-card">
          <p>Volatilite (nuls)</p>
          <strong>{stats.volatility}%</strong>
          <span>Matchs equilibres</span>
        </article>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="section-head">
            <h2>Indice de forme collectif</h2>
            <p>Score agrege des 7 derniers cycles.</p>
          </div>
          <div className="chart">
            <svg viewBox="0 0 240 120" role="img" aria-label="Form trend">
              <polyline
                fill="none"
                stroke="url(#grad)"
                strokeWidth="4"
                points={trendPoints
                  .map((point, index) => `${index * 35},${110 - point * 3}`)
                  .join(" ")}
              />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#49e26f" />
                  <stop offset="100%" stopColor="#f7c948" />
                </linearGradient>
              </defs>
            </svg>
            <div className="chart-legend">
              <span>Base</span>
              <span>Pic de forme</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <h2>Alertes IA prioritaires</h2>
            <p>Dernieres anomalies detectees.</p>
          </div>
          <ul className="alerts">
            <li>
              <strong>Risque de blessure</strong>
              <span>Charge elevee detectee sur le dernier cycle.</span>
            </li>
            <li>
              <strong>Fatigue collective</strong>
              <span>Baisse d'intensite dans le dernier tiers du match.</span>
            </li>
            <li>
              <strong>Opportunite tactique</strong>
              <span>Zone forte exploitable identifiee par l'IA.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="section-head">
            <h2>{isFootball ? "Tendance xG" : "Tendance offensive"}</h2>
            <p>
              {isFootball
                ? "Evolution des expected goals sur 7 cycles."
                : "Evolution d'un indice offensif sur 7 cycles."}
            </p>
          </div>
          <div className="chart">
            <svg viewBox="0 0 240 120" role="img" aria-label="Offensive trend">
              <polyline
                fill="none"
                stroke="#4ad6ff"
                strokeWidth="4"
                points={xgTrend
                  .map((point, index) => `${index * 35},${110 - point * 35}`)
                  .join(" ")}
              />
            </svg>
            <div className="chart-legend">
              <span>{isFootball ? "xG bas" : "Indice bas"}</span>
              <span>{isFootball ? "xG haut" : "Indice haut"}</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <h2>Chronologie de la rencontre</h2>
            <p>Moments cles et zones d'impact.</p>
          </div>
          <div className="timeline">
            <div className="timeline-row">
              <span>10'</span>
              <div className="timeline-bar">
                <div className="timeline-event high" style={{ width: "15%" }} />
              </div>
              <span>Pressing haut</span>
            </div>
            <div className="timeline-row">
              <span>34'</span>
              <div className="timeline-bar">
                <div className="timeline-event medium" style={{ width: "48%" }} />
              </div>
              <span>Transition rapide</span>
            </div>
            <div className="timeline-row">
              <span>71'</span>
              <div className="timeline-bar">
                <div className="timeline-event low" style={{ width: "72%" }} />
              </div>
              <span>Baisse de regime</span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>{isFootball ? "Carte thermique d'occupation" : "Carte des zones d'impact"}</h2>
            <p>
              {isFootball
                ? "Zones de presence moyenne sur 90 minutes."
                : "Visualisation generique des zones de presence."}
            </p>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={animateHeat}
              onChange={(e) => setAnimateHeat(e.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span>Animation</span>
          </label>
        </div>
        <div className={`pitch ${animateHeat ? "heat-animate" : "heat-static"}`}>
          {isFootball ? (
            <div className="pitch-lines">
              <span className="pitch-half" />
              <span className="pitch-circle" />
              <span className="pitch-spot" />
              <span className="pitch-box left" />
              <span className="pitch-box right" />
              <span className="pitch-pen left" />
              <span className="pitch-pen right" />
              <span className="pitch-goal left" />
              <span className="pitch-goal right" />
              <span className="pitch-arc left" />
              <span className="pitch-arc right" />
              <span className="pitch-pen-spot left" />
              <span className="pitch-pen-spot right" />
              <span className="pitch-corner tl" />
              <span className="pitch-corner tr" />
              <span className="pitch-corner bl" />
              <span className="pitch-corner br" />
            </div>
          ) : null}
          <div className={isFootball ? "heatmap-grid" : "heatmap"}>
            {heatCells.map((level, idx) => (
              <span key={idx} className={`heatmap-cell heat-${level}`} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
