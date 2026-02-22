const fs = require("fs");
const path = require("path");
const express = require("express");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const Match = require("../models/Match");
const { normalizeSport, SPORT_LABELS, SPORT_VALUES } = require("../constants/sports");

const router = express.Router();
const samplePath = path.join(__dirname, "..", "data", "sample-matches.json");

const loadSample = () => {
  try {
    const raw = fs.readFileSync(samplePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
};

const filterSampleBySport = (rows, sport) => {
  if (!sport) return rows;
  return rows.filter((row) => normalizeSport(row.sport) === sport);
};

const fetchMatches = async (sport) => {
  const isDbReady = Match.db?.readyState === 1;
  if (!isDbReady) {
    return filterSampleBySport(loadSample(), sport);
  }
  const query = sport ? { sport } : {};
  return Match.find(query).sort({ date: -1 }).limit(50);
};

const buildStats = (matches) => {
  if (!matches.length) {
    return { total: 0, avgGoals: 0, homeWinRate: 0, volatility: 0 };
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
};

const buildSummary = (stats, sport) => {
  const avg = Number(stats.avgGoals || 0);
  const home = Number(stats.homeWinRate || 0);
  const draw = Number(stats.volatility || 0);

  const goalsTone = avg >= 2.6 ? "offensif" : avg <= 1.8 ? "ferme" : "equilibre";
  const homeTone = home >= 55 ? "fort" : home <= 40 ? "faible" : "modere";
  const drawTone = draw >= 30 ? "eleve" : "normal";

  return (
    `Le championnat montre un profil ${goalsTone} avec ${avg} ${
      sport === "football" ? "buts" : "points"
    }/match. ` +
    `L'avantage domicile est ${homeTone} (${home}%). ` +
    `Le taux de nuls est ${drawTone} (${draw}%).`
  );
};

router.get("/pdf", async (req, res) => {
  const sport = req.query.sport ? normalizeSport(req.query.sport) : null;
  if (req.query.sport && !sport) {
    return res.status(400).json({
      error: "Invalid sport",
      supported_sports: SPORT_VALUES,
    });
  }

  try {
    const matches = await fetchMatches(sport);
    const stats = buildStats(matches);
    const summary = buildSummary(stats, sport);
    const sportLabel = sport ? SPORT_LABELS[sport] : "Tous sports";
    const avgLabel = sport === "football" ? "Moyenne de buts" : "Points moyens";

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const colors = {
      bg: rgb(0.06, 0.09, 0.08),
      panel: rgb(0.09, 0.13, 0.12),
      panelSoft: rgb(0.12, 0.17, 0.15),
      accent: rgb(0.31, 0.88, 0.45),
      accentSoft: rgb(0.95, 0.78, 0.28),
      text: rgb(0.95, 0.97, 0.94),
      muted: rgb(0.68, 0.74, 0.71),
      stroke: rgb(0.2, 0.26, 0.24),
    };

    page.drawRectangle({ x: 0, y: 0, width, height, color: colors.bg });
    page.drawRectangle({ x: 0, y: height - 130, width, height: 130, color: colors.panel });
    page.drawRectangle({ x: 0, y: height - 12, width, height: 12, color: colors.accent });

    page.drawText("SPORT AI", {
      x: 34,
      y: height - 52,
      size: 10,
      font: fontBold,
      color: colors.accentSoft,
    });
    page.drawText(`Rapport de performance - ${sportLabel}`, {
      x: 34,
      y: height - 78,
      size: 21,
      font: fontBold,
      color: colors.text,
    });
    page.drawText(`Genere le ${new Date().toLocaleString("fr-FR")}`, {
      x: 34,
      y: height - 98,
      size: 10,
      font,
      color: colors.muted,
    });

    const summaryTop = height - 165;
    page.drawRectangle({
      x: 34,
      y: summaryTop - 68,
      width: width - 68,
      height: 68,
      color: colors.panelSoft,
      borderColor: colors.stroke,
      borderWidth: 1,
    });
    page.drawText("Synthese IA", {
      x: 50,
      y: summaryTop - 20,
      size: 11,
      font: fontBold,
      color: colors.accentSoft,
    });
    page.drawText(summary, {
      x: 50,
      y: summaryTop - 40,
      size: 10,
      font,
      color: colors.muted,
      maxWidth: width - 100,
    });

    const cards = [
      { label: "Matchs analyses", value: String(stats.total) },
      { label: avgLabel, value: String(stats.avgGoals) },
      { label: "Victoire equipe A", value: `${stats.homeWinRate}%` },
      { label: "Volatilite (nuls)", value: `${stats.volatility}%` },
    ];

    const cardY = summaryTop - 96;
    cards.forEach((card, idx) => {
      const cardW = 126;
      const gap = 12;
      const x = 34 + idx * (cardW + gap);
      page.drawRectangle({
        x,
        y: cardY - 72,
        width: cardW,
        height: 72,
        color: colors.panelSoft,
        borderColor: colors.stroke,
        borderWidth: 1,
      });
      page.drawText(card.label, {
        x: x + 10,
        y: cardY - 24,
        size: 8.5,
        font,
        color: colors.muted,
      });
      page.drawText(card.value, {
        x: x + 10,
        y: cardY - 50,
        size: 18,
        font: fontBold,
        color: colors.accent,
      });
    });

    const chartY = cardY - 102;
    page.drawText(`Indice ${avgLabel.toLowerCase()}`, {
      x: 34,
      y: chartY,
      size: 11,
      font: fontBold,
      color: colors.text,
    });
    page.drawRectangle({ x: 34, y: chartY - 26, width: 260, height: 10, color: colors.stroke });
    const maxAvg = sport === "football" ? 4 : 120;
    const fillWidth = Math.max(2, Math.min(260, (Number(stats.avgGoals) / maxAvg) * 260));
    page.drawRectangle({ x: 34, y: chartY - 26, width: fillWidth, height: 10, color: colors.accent });
    page.drawText(`${stats.avgGoals} / match`, {
      x: 300,
      y: chartY - 24,
      size: 10,
      font: fontBold,
      color: colors.accentSoft,
    });

    const tableTop = chartY - 58;
    page.drawText("Derniers matchs", {
      x: 34,
      y: tableTop,
      size: 12,
      font: fontBold,
      color: colors.text,
    });
    page.drawRectangle({
      x: 34,
      y: tableTop - 18,
      width: width - 68,
      height: 20,
      color: colors.panel,
      borderColor: colors.stroke,
      borderWidth: 1,
    });
    page.drawText("Equipe A", { x: 44, y: tableTop - 11, size: 9, font: fontBold, color: colors.muted });
    page.drawText("Score", { x: 250, y: tableTop - 11, size: 9, font: fontBold, color: colors.muted });
    page.drawText("Equipe B", { x: 320, y: tableTop - 11, size: 9, font: fontBold, color: colors.muted });
    page.drawText("Date", { x: 500, y: tableTop - 11, size: 9, font: fontBold, color: colors.muted });

    const rows = matches.slice(0, 10);
    let rowY = tableTop - 36;
    if (!rows.length) {
      page.drawText("Aucun match disponible.", { x: 44, y: rowY, size: 10, font, color: colors.muted });
    } else {
      rows.forEach((match, idx) => {
        const isEven = idx % 2 === 0;
        page.drawRectangle({
          x: 34,
          y: rowY - 4,
          width: width - 68,
          height: 16,
          color: isEven ? colors.panelSoft : colors.panel,
        });
        page.drawText(String(match.teamA || "-"), { x: 44, y: rowY, size: 9, font, color: colors.text });
        page.drawText(`${match.scoreA ?? "-"} - ${match.scoreB ?? "-"}`, {
          x: 250,
          y: rowY,
          size: 9,
          font: fontBold,
          color: colors.accent,
        });
        page.drawText(String(match.teamB || "-"), { x: 320, y: rowY, size: 9, font, color: colors.text });
        page.drawText(String(match.date || "-"), { x: 500, y: rowY, size: 8, font, color: colors.muted });
        rowY -= 18;
      });
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    const fileSuffix = sport || "all-sports";
    res.setHeader("Content-Disposition", `attachment; filename=sport-ai-${fileSuffix}-rapport.pdf`);
    return res.send(Buffer.from(pdfBytes));
  } catch (error) {
    return res.status(500).json({ error: "Report generation failed" });
  }
});

module.exports = router;
