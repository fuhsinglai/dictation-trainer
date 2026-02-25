/**
 * Section Progress Panel - displays section trend chart and sentence-level improvement.
 * Depends on: getScores, checkHistory, currentArticleId, toSentenceId, parseIndexFromId,
 *             sectionIndex, isRepeatMode, fullSectionIndex.
 */
(function () {
  "use strict";

  var SMALL_WORDS = ["a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "by", "from", "is", "are", "was", "were"];
  var TENSE_PAIRS = [
    ["fall", "fell"], ["run", "ran"], ["go", "went"], ["say", "said"], ["see", "saw"], ["get", "got"],
    ["make", "made"], ["take", "took"], ["come", "came"], ["give", "gave"], ["know", "knew"],
    ["think", "thought"], ["find", "found"], ["tell", "told"], ["leave", "left"], ["feel", "felt"]
  ];

  function getEffectiveSectionIndex() {
    if (typeof isRepeatMode !== "undefined" && isRepeatMode && typeof fullSectionIndex !== "undefined" && fullSectionIndex.length) {
      return fullSectionIndex;
    }
    return typeof sectionIndex !== "undefined" ? sectionIndex : [];
  }

  function getSectionScores(sec) {
    var scores = typeof getScores === "function" ? getScores() : [];
    var aid = typeof currentArticleId !== "undefined" ? currentArticleId : "";
    return scores
      .filter(function (r) {
        return (r.articleId || "pasted") === (aid || "pasted") && (r.sectionIndex ?? 0) === sec;
      })
      .sort(function (a, b) {
        return new Date(a.ts || 0).getTime() - new Date(b.ts || 0).getTime();
      });
  }

  function isSectionMastered(sectionScores) {
    if (!sectionScores || sectionScores.length === 0) return false;
    var last = sectionScores[sectionScores.length - 1];
    return (last.accuracy || 0) >= 100;
  }

  function getMasteryStats(sec) {
    var sectionScores = getSectionScores(sec);
    if (sectionScores.length === 0) return null;
    var firstTs = new Date(sectionScores[0].ts || 0).getTime();
    var lastTs = new Date(sectionScores[sectionScores.length - 1].ts || 0).getTime();
    var totalWordsTyped = sectionScores.reduce(function (s, r) { return s + (r.wordCount || 0); }, 0);
    var spanMs = lastTs - firstTs;
    var spanMins = Math.round(spanMs / 60000);
    var spanDays = Math.ceil(spanMs / (24 * 60 * 60 * 1000));

    var firstWPM = null;
    var lastWPM = null;
    if (sectionScores.length >= 2) {
      var sec0 = (new Date(sectionScores[1].ts || 0).getTime() - new Date(sectionScores[0].ts || 0).getTime()) / 1000;
      if (sec0 > 0) firstWPM = Math.round(((sectionScores[0].wordCount || 0) * 60) / sec0);
      var last100Idx = -1;
      for (var i = sectionScores.length - 1; i >= 0; i--) {
        if ((sectionScores[i].accuracy || 0) >= 100) {
          last100Idx = i;
          break;
        }
      }
      if (last100Idx > 0) {
        var secLast = (new Date(sectionScores[last100Idx].ts || 0).getTime() - new Date(sectionScores[last100Idx - 1].ts || 0).getTime()) / 1000;
        if (secLast > 0) lastWPM = Math.round(((sectionScores[last100Idx].wordCount || 0) * 60) / secLast);
      }
    }

    return {
      totalPracticeSpanMs: spanMs,
      totalPracticeSpanMins: spanMins,
      totalPracticeSpanDays: spanDays,
      attemptCount: sectionScores.length,
      totalWordsTyped: totalWordsTyped,
      firstWPM: firstWPM,
      lastWPM: lastWPM
    };
  }

  function getActivityByDate(sec) {
    var scores = typeof getScores === "function" ? getScores() : [];
    var aid = typeof currentArticleId !== "undefined" ? currentArticleId : "";
    var byDate = {};
    scores
      .filter(function (r) {
        return (r.articleId || "pasted") === (aid || "pasted");
      })
      .forEach(function (r) {
        var d = r.ts ? new Date(r.ts).toISOString().slice(0, 10) : "";
        if (d) {
          if (!byDate[d]) byDate[d] = { count: 0, wordCount: 0 };
          byDate[d].count += 1;
          byDate[d].wordCount += r.wordCount || 0;
        }
      });
    return byDate;
  }

  function isSmallWord(w) {
    return w && SMALL_WORDS.indexOf(w.toLowerCase()) >= 0;
  }

  function isTenseError(ref, user) {
    if (!ref || !user) return false;
    var r = ref.toLowerCase();
    var u = user.toLowerCase();
    for (var i = 0; i < TENSE_PAIRS.length; i++) {
      var p = TENSE_PAIRS[i];
      if ((p[0] === r && p[1] === u) || (p[1] === r && p[0] === u)) return true;
    }
    return false;
  }

  function getErrorWords(errors) {
    var words = [];
    (errors || []).forEach(function (e) {
      if (e.type === "del") words.push({ word: e.word, type: "del" });
      else if (e.type === "ins") words.push({ word: e.word, type: "ins" });
      else if (e.type === "sub") words.push({ word: e.ref, type: "sub", user: e.user });
    });
    return words;
  }

  function generateAttribution(prevErrors, currErrors) {
    var prev = getErrorWords(prevErrors);
    var curr = getErrorWords(currErrors);
    var prevWordSet = {};
    prev.forEach(function (e) {
      var k = e.word + (e.type === "sub" ? ":" + (e.user || "") : "");
      prevWordSet[k] = e;
    });
    var currWordSet = {};
    curr.forEach(function (e) {
      var k = e.word + (e.type === "sub" ? ":" + (e.user || "") : "");
      currWordSet[k] = e;
    });

    var fixed = [];
    for (var k in prevWordSet) {
      if (!currWordSet[k]) {
        var e = prevWordSet[k];
        if (e.type === "del" && isSmallWord(e.word)) fixed.push("Captured small words");
        else if (e.type === "del") fixed.push("Fixed omissions");
        else if (e.type === "ins") fixed.push("Reduced extra words");
        else if (e.type === "sub" && isTenseError(e.word, e.user)) fixed.push("Fixed tense error");
        else if (e.type === "sub") fixed.push("Fixed spelling");
      }
    }
    var seen = {};
    fixed = fixed.filter(function (s) {
      if (seen[s]) return false;
      seen[s] = true;
      return true;
    });
    return fixed.length ? fixed.join("; ") : null;
  }

  function getSentenceImprovements(sec) {
    var history = typeof checkHistory !== "undefined" ? checkHistory : [];
    var aid = typeof currentArticleId !== "undefined" ? currentArticleId : "";
    var effSec = getEffectiveSectionIndex();
    var sectionSentenceIndices = effSec
      .map(function (s, i) {
        return s === sec ? i : -1;
      })
      .filter(function (i) {
        return i >= 0;
      });

    var bySentence = {};
    history
      .filter(function (h) {
        return (h.sectionIndex ?? 0) === sec;
      })
      .forEach(function (h) {
        var sid = h.sentenceId || (aid ? toSentenceId(aid, (h.sentenceNum || 1) - 1) : "n" + (h.sentenceNum || 0));
        if (!bySentence[sid]) bySentence[sid] = [];
        bySentence[sid].push(h);
      });

    return sectionSentenceIndices.map(function (globalIdx) {
      var sid = toSentenceId(aid, globalIdx);
      var entries = bySentence[sid] || [];
      var prevEntry = entries.length >= 2 ? entries[entries.length - 2] : null;
      var currEntry = entries.length >= 1 ? entries[entries.length - 1] : null;
      var prev = prevEntry ? prevEntry.accPct : null;
      var curr = currEntry ? currEntry.accPct : null;
      var attribution = null;
      if (prevEntry && currEntry && curr > prev) {
        attribution = generateAttribution(prevEntry.errors, currEntry.errors);
      }
      var posInSection = sectionSentenceIndices.indexOf(globalIdx) + 1;
      return {
        posInSection: posInSection,
        totalInSection: sectionSentenceIndices.length,
        prev: prev,
        curr: curr,
        attribution: attribution,
        practiceCount: entries.length
      };
    });
  }

  function getWordWallData(sec) {
    var history = typeof checkHistory !== "undefined" ? checkHistory : [];
    var aid = typeof currentArticleId !== "undefined" ? currentArticleId : "";
    var effSec = getEffectiveSectionIndex();
    var sectionSentenceIndices = effSec
      .map(function (s, i) {
        return s === sec ? i : -1;
      })
      .filter(function (i) {
        return i >= 0;
      });

    var errorCount = {};
    var bySentence = {};
    history
      .filter(function (h) {
        return (h.sectionIndex ?? 0) === sec;
      })
      .forEach(function (h) {
        var sid = h.sentenceId || (aid ? toSentenceId(aid, (h.sentenceNum || 1) - 1) : "n" + (h.sentenceNum || 0));
        if (!bySentence[sid]) bySentence[sid] = [];
        bySentence[sid].push(h);

        (h.errors || []).forEach(function (e) {
          var w = e.type === "sub" ? e.ref : e.word;
          if (w) errorCount[w] = (errorCount[w] || 0) + 1;
        });
      });

    var improved = {};
    for (var sid in bySentence) {
      var entries = bySentence[sid];
      if (entries.length < 2) continue;
      var prev = entries[entries.length - 2];
      var curr = entries[entries.length - 1];
      var prevWords = {};
      (prev.errors || []).forEach(function (e) {
        var w = e.type === "sub" ? e.ref : e.word;
        if (w) prevWords[w] = true;
      });
      var currWords = {};
      (curr.errors || []).forEach(function (e) {
        var w = e.type === "sub" ? e.ref : e.word;
        if (w) currWords[w] = true;
      });
      for (var w in prevWords) {
        if (!currWords[w] && prev.accPct < curr.accPct) {
          improved[w] = (improved[w] || 0) + 1;
        }
      }
    }

    var errorRateOrder = Object.entries(errorCount)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 8);
    var improvedOrder = Object.entries(improved)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 8);

    var secHistory = history
      .filter(function (h) {
        return (h.sectionIndex ?? 0) === sec;
      });
    var n = secHistory.length;
    var firstHalf = secHistory.slice(0, Math.min(10, Math.floor(n / 2)));
    var lastHalf = secHistory.slice(Math.max(0, n - 10), n);
    var firstErrors = {};
    var lastErrors = {};
    firstHalf.forEach(function (h) {
      (h.errors || []).forEach(function (e) {
        var w = e.type === "sub" ? e.ref : e.word;
        if (w) firstErrors[w] = (firstErrors[w] || 0) + 1;
      });
    });
    lastHalf.forEach(function (h) {
      (h.errors || []).forEach(function (e) {
        var w = e.type === "sub" ? e.ref : e.word;
        if (w) lastErrors[w] = (lastErrors[w] || 0) + 1;
      });
    });
    var firstTop = Object.entries(firstErrors)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 10)
      .map(function (e) {
        return e[0];
      });
    var lastTop = Object.entries(lastErrors)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 10)
      .map(function (e) {
        return e[0];
      });
    var lastTopSet = {};
    lastTop.forEach(function (w) {
      lastTopSet[w] = true;
    });
    var eliminated = firstTop.filter(function (w) {
      return !lastTopSet[w];
    });

    return { errorProne: errorRateOrder, improved: improvedOrder, eliminated: eliminated };
  }

  function getMilestoneText(sectionScores) {
    if (!sectionScores || sectionScores.length < 2) return null;
    var last = sectionScores[sectionScores.length - 1].accuracy || 0;
    if (last >= 100) return "You've hit 100% accuracy for this section!";
    var first = sectionScores[0].accuracy || 0;
    var rate = (last - first) / (sectionScores.length - 1);
    if (rate <= 0) return null;
    var gap = 100 - last;
    var sessions = Math.ceil(gap / rate);
    if (sessions <= 0) return null;
    return "At this rate, you are " + sessions + " practice session" + (sessions === 1 ? "" : "s") + " away from hitting 100% accuracy for this section!";
  }

  function generateAISummary(sec, sectionScores, improvements, wordWall) {
    var parts = [];
    var improving = [];
    var struggling = [];

    improvements.forEach(function (item) {
      if (item.attribution) {
        if (item.attribution.indexOf("small words") >= 0) improving.push("small words");
        else if (item.attribution.indexOf("tense") >= 0) improving.push("verbs/tense");
        else if (item.attribution.indexOf("spelling") >= 0) improving.push("spelling");
        else if (item.attribution.indexOf("omissions") >= 0) improving.push("listening");
      }
    });

    wordWall.errorProne.slice(0, 5).forEach(function (e) {
      var w = e[0];
      if (isSmallWord(w)) struggling.push("prepositions/function words");
      else struggling.push(w);
    });

    var seenImproving = {};
    improving = improving.filter(function (x) {
      if (seenImproving[x]) return false;
      seenImproving[x] = true;
      return true;
    });
    var seenStruggling = {};
    struggling = struggling.filter(function (x) {
      if (seenStruggling[x]) return false;
      seenStruggling[x] = true;
      return true;
    });

    var trendUp = sectionScores.length >= 2 && sectionScores[sectionScores.length - 1].accuracy > sectionScores[0].accuracy;
    var lastAvg = sectionScores.length ? sectionScores[sectionScores.length - 1].accuracy : 0;

    if (improving.length > 0) {
      parts.push("You're improving at " + improving.slice(0, 2).join(" and ") + ".");
    }
    if (struggling.length > 0) {
      var struggleStr = struggling.slice(0, 2).join(", ");
      if (struggleStr.indexOf("prepositions") >= 0) {
        parts.push("You still struggle with prepositions and small words.");
      } else {
        parts.push("Words to focus on: " + struggleStr + ".");
      }
    }
    if (parts.length === 0) {
      if (trendUp) parts.push("Your section trend is improving. Keep practicing!");
      else if (lastAvg >= 90) parts.push("Strong performance! Try faster playback or harder articles.");
      else parts.push("Keep practicing to see more detailed feedback.");
    }

    var suggestion = "";
    if (struggling.some(function (s) {
      return s.indexOf("preposition") >= 0 || s.indexOf("function") >= 0;
    })) {
      suggestion = "Suggested next step: Focus on preposition-heavy articles and listen for small words (a, the, to, of).";
    } else if (improving.some(function (s) {
      return s.indexOf("tense") >= 0 || s.indexOf("verb") >= 0;
    })) {
      suggestion = "Suggested next step: Continue with varied verb tenses to consolidate gains.";
    } else if (trendUp) {
      suggestion = "Suggested next step: Try increasing playback speed or a longer section.";
    } else {
      suggestion = "Suggested next step: Re-practice low-accuracy sentences in this section.";
    }

    return {
      summary: parts.join(" "),
      suggestion: suggestion
    };
  }

  function renderMasteryMilestone(panelEl, stats) {
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-mastery-wrap";
    wrap.innerHTML = "<span class=\"progress-panel-mastery-icon\" aria-hidden=\"true\">🏆</span> <span class=\"progress-panel-mastery-title\">Persistence pays off!</span>";
    var list = document.createElement("div");
    list.className = "progress-panel-mastery-stats";
    var timeStr = stats.totalPracticeSpanMins < 60
      ? stats.totalPracticeSpanMins + " minutes"
      : Math.floor(stats.totalPracticeSpanMins / 60) + "h " + (stats.totalPracticeSpanMins % 60) + "m";
    if (stats.totalPracticeSpanDays > 0) timeStr += " over " + stats.totalPracticeSpanDays + " day" + (stats.totalPracticeSpanDays === 1 ? "" : "s");
    list.innerHTML = "<div><strong>Total Practice Time:</strong> " + timeStr + "</div>" +
      "<div><strong>Attempt Count:</strong> " + stats.attemptCount + " checks</div>" +
      "<div><strong>Total Words Typed:</strong> " + stats.totalWordsTyped + "</div>";
    wrap.appendChild(list);
    panelEl.appendChild(wrap);
  }

  function renderSpeedEvolution(panelEl, stats) {
    if (stats.firstWPM == null || stats.lastWPM == null) return;
    if (stats.firstWPM === stats.lastWPM) return;
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-speed-wrap";
    wrap.textContent = "Your typing speed increased from " + stats.firstWPM + " WPM to " + stats.lastWPM + " WPM!";
    panelEl.appendChild(wrap);
  }

  function renderTimelapseAnimation(panelEl, sectionScores, stats) {
    if (!sectionScores || sectionScores.length < 2) return;
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-timelapse-wrap";
    var canvas = document.createElement("canvas");
    canvas.className = "progress-panel-timelapse-chart";
    canvas.width = 220;
    canvas.height = 50;
    wrap.appendChild(canvas);

    var timeStr = stats.totalPracticeSpanMins + " min of practice";
    if (stats.totalPracticeSpanDays > 0) timeStr += " over " + stats.totalPracticeSpanDays + " day" + (stats.totalPracticeSpanDays === 1 ? "" : "s");
    var doneLabel = document.createElement("div");
    doneLabel.className = "progress-panel-timelapse-done";
    doneLabel.textContent = "Done in " + timeStr + "!";
    wrap.appendChild(doneLabel);

    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    var pad = 4;
    var x0 = pad;
    var x1 = w - pad;
    var y0 = pad;
    var y1 = h - pad;
    var totalFrames = 40;
    var frame = 0;

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var progress = Math.min(1, frame / totalFrames);
      var n = sectionScores.length;
      var idx = Math.floor(progress * (n - 1));
      if (idx < 0) idx = 0;
      ctx.strokeStyle = "#2a7";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var i = 0; i <= idx; i++) {
        var x = x0 + (i / (n - 1)) * (x1 - x0);
        var y = y1 - ((sectionScores[i].accuracy || 0) / 100) * (y1 - y0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (idx < n - 1 && progress < 1) {
        var frac = (progress * (n - 1)) - idx;
        var nextX = x0 + ((idx + 1) / (n - 1)) * (x1 - x0);
        var nextY = y1 - ((sectionScores[idx + 1].accuracy || 0) / 100) * (y1 - y0);
        var currX = x0 + (idx / (n - 1)) * (x1 - x0);
        var currY = y1 - ((sectionScores[idx].accuracy || 0) / 100) * (y1 - y0);
        ctx.lineTo(currX + (nextX - currX) * frac, currY + (nextY - currY) * frac);
      }
      ctx.stroke();
    }

    function animate() {
      frame++;
      draw();
      if (frame < totalFrames) {
        requestAnimationFrame(animate);
      } else {
        draw();
      }
    }

    draw();
    setTimeout(function () { animate(); }, 300);
    panelEl.appendChild(wrap);
  }

  function renderActivityHeatmap(panelEl, sec) {
    var byDate = getActivityByDate(sec);
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-heatmap-wrap";
    var title = document.createElement("div");
    title.className = "progress-panel-title";
    title.textContent = "Activity (checks per day)";
    wrap.appendChild(title);

    var cols = 7;
    var rows = 12;
    var totalDays = cols * rows;
    var maxCount = 0;
    for (var k in byDate) {
      var cnt = typeof byDate[k] === "object" ? byDate[k].count : byDate[k];
      if (cnt > maxCount) maxCount = cnt;
    }
    if (maxCount === 0) maxCount = 1;

    var grid = document.createElement("div");
    grid.className = "progress-panel-heatmap-grid";
    for (var r = 0; r < rows; r++) {
      var rowEl = document.createElement("div");
      rowEl.className = "progress-panel-heatmap-row";
      for (var c = 0; c < cols; c++) {
        var idx = r * cols + c;
        var d = new Date();
        d.setDate(d.getDate() - (totalDays - 1 - idx));
        var dateStr = d.toISOString().slice(0, 10);
        var dayData = byDate[dateStr];
        var count = dayData ? (typeof dayData === "object" ? dayData.count : dayData) : 0;
        var wordCount = dayData && typeof dayData === "object" ? dayData.wordCount : 0;
        var cell = document.createElement("div");
        cell.className = "progress-panel-heatmap-cell";
        var level = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
        cell.classList.add("heatmap-l" + level);
        var tip = dateStr + ": " + count + " check" + (count === 1 ? "" : "s");
        if (wordCount > 0) tip += ", 聽打總字數 " + wordCount;
        cell.title = tip;
        rowEl.appendChild(cell);
      }
      grid.appendChild(rowEl);
    }
    wrap.appendChild(grid);
    var legend = document.createElement("div");
    legend.className = "progress-panel-heatmap-legend";
    legend.innerHTML = "<span>Less</span> <span class=\"heatmap-l0\"></span><span class=\"heatmap-l1\"></span><span class=\"heatmap-l2\"></span><span class=\"heatmap-l3\"></span><span class=\"heatmap-l4\"></span> <span>More</span>";
    wrap.appendChild(legend);
    panelEl.appendChild(wrap);
  }

  function renderMilestone(panelEl, sectionScores) {
    var text = getMilestoneText(sectionScores);
    if (!text) return;
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-milestone-wrap";
    wrap.textContent = text;
    panelEl.appendChild(wrap);
  }

  function renderTrendChart(panelEl, sectionScores) {
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-chart-wrap";
    var title = document.createElement("div");
    title.className = "progress-panel-title";
    title.textContent = "Section trend";
    wrap.appendChild(title);

    renderMilestone(wrap, sectionScores);

    if (sectionScores.length < 2) {
      var msg = document.createElement("div");
      msg.className = "progress-panel-muted";
      msg.textContent = sectionScores.length === 0 ? "No data yet" : "Need at least 2 checks to show trend";
      wrap.appendChild(msg);
      panelEl.appendChild(wrap);
      return;
    }

    var canvas = document.createElement("canvas");
    canvas.className = "progress-panel-chart";
    canvas.width = 240;
    canvas.height = 60;
    wrap.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#2a7";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    var pad = 4;
    var x0 = pad;
    var x1 = w - pad;
    var y0 = pad;
    var y1 = h - pad;
    sectionScores.forEach(function (r, i) {
      var x = x0 + (i / (sectionScores.length - 1)) * (x1 - x0);
      var y = y1 - ((r.accuracy || 0) / 100) * (y1 - y0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    panelEl.appendChild(wrap);
  }

  function renderWordWall(panelEl, wordWall) {
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-wordwall-wrap";
    var title = document.createElement("div");
    title.className = "progress-panel-title";
    title.textContent = "Word Wall";
    wrap.appendChild(title);

    var grid = document.createElement("div");
    grid.className = "progress-panel-wordwall-grid";

    var col1 = document.createElement("div");
    col1.className = "progress-panel-wordwall-col progress-panel-wordwall-col-bad";
    var h1 = document.createElement("div");
    h1.className = "progress-panel-wordwall-label";
    h1.textContent = "Highest error rate";
    col1.appendChild(h1);
    var list1 = document.createElement("div");
    list1.className = "progress-panel-wordwall-list";
    if (wordWall.errorProne.length === 0) {
      list1.textContent = "—";
    } else {
      wordWall.errorProne.forEach(function (e) {
        var span = document.createElement("span");
        span.className = "progress-panel-word-bad";
        span.textContent = e[0] + " (" + e[1] + ")";
        list1.appendChild(span);
      });
    }
    col1.appendChild(list1);
    grid.appendChild(col1);

    var col2 = document.createElement("div");
    col2.className = "progress-panel-wordwall-col progress-panel-wordwall-col-good";
    var h2 = document.createElement("div");
    h2.className = "progress-panel-wordwall-label";
    h2.textContent = "Improving fastest";
    col2.appendChild(h2);
    var list2 = document.createElement("div");
    list2.className = "progress-panel-wordwall-list";
    if (wordWall.improved.length === 0) {
      list2.textContent = "—";
    } else {
      wordWall.improved.forEach(function (e) {
        var span = document.createElement("span");
        span.className = "progress-panel-word-good";
        span.textContent = e[0] + " (" + e[1] + ")";
        list2.appendChild(span);
      });
    }
    col2.appendChild(list2);
    grid.appendChild(col2);

    if (wordWall.eliminated && wordWall.eliminated.length > 0) {
      var col3 = document.createElement("div");
      col3.className = "progress-panel-wordwall-col progress-panel-wordwall-col-full";
      var h3 = document.createElement("div");
      h3.className = "progress-panel-wordwall-label";
      h3.textContent = "Eliminated (was in top errors, now fixed)";
      col3.appendChild(h3);
      var list3 = document.createElement("div");
      list3.className = "progress-panel-wordwall-list";
      wordWall.eliminated.forEach(function (w) {
        var span = document.createElement("span");
        span.className = "progress-panel-word-eliminated progress-panel-word-eliminated-animate";
        span.innerHTML = "<span class=\"word-eliminated-text\">" + w + "</span> <span class=\"word-eliminated-badge\">Eliminated!</span>";
        list3.appendChild(span);
      });
      col3.appendChild(list3);
      grid.appendChild(col3);
    }

    wrap.appendChild(grid);
    panelEl.appendChild(wrap);
  }

  function renderSentenceList(panelEl, improvements) {
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-sentences-wrap";
    var title = document.createElement("div");
    title.className = "progress-panel-title";
    title.textContent = "Sentence improvement (last → current)";
    wrap.appendChild(title);

    var list = document.createElement("div");
    list.className = "progress-panel-sentence-list";

    if (improvements.length === 0) {
      var msg = document.createElement("div");
      msg.className = "progress-panel-muted";
      msg.textContent = "No sentence data";
      list.appendChild(msg);
    } else {
      improvements.forEach(function (item) {
        var row = document.createElement("div");
        row.className = "progress-panel-sentence-row";
        var label = "#" + item.posInSection + "/" + item.totalInSection;
        var countStr = (item.practiceCount || 0) > 0 ? " (練 " + item.practiceCount + " 次)" : "";
        var prevStr = item.prev !== null ? item.prev + "%" : "—";
        var currStr = item.curr !== null ? item.curr + "%" : "—";
        var text = label + countStr + ": " + prevStr + " → " + currStr;
        if (item.prev !== null && item.curr !== null && item.curr > item.prev) {
          row.classList.add("progress-up");
        } else if (item.prev !== null && item.curr !== null && item.curr < item.prev) {
          row.classList.add("progress-down");
        }
        row.appendChild(document.createTextNode(text));
        if (item.prev !== null && item.curr !== null && (item.curr - item.prev) > 50) {
          var star = document.createElement("span");
          star.className = "progress-panel-star";
          star.textContent = " ⭐";
          star.title = "Improvement over 50%!";
          row.appendChild(star);
        }
        if (item.attribution) {
          var attr = document.createElement("span");
          attr.className = "progress-panel-attribution";
          attr.textContent = " — " + item.attribution;
          row.appendChild(attr);
        }
        list.appendChild(row);
      });
    }
    wrap.appendChild(list);
    panelEl.appendChild(wrap);
  }

  function renderAISummary(panelEl, ai) {
    var wrap = document.createElement("div");
    wrap.className = "progress-panel-ai-wrap";
    var title = document.createElement("div");
    title.className = "progress-panel-title";
    title.textContent = "AI summary";
    wrap.appendChild(title);
    var summary = document.createElement("div");
    summary.className = "progress-panel-ai-summary";
    summary.textContent = ai.summary;
    wrap.appendChild(summary);
    var suggestion = document.createElement("div");
    suggestion.className = "progress-panel-ai-suggestion";
    suggestion.textContent = ai.suggestion;
    wrap.appendChild(suggestion);
    panelEl.appendChild(wrap);
  }

  function renderSectionProgressPanel(sec, panelEl) {
    panelEl.innerHTML = "";
    panelEl.className = "history-progress-panel";

    var sectionScores = getSectionScores(sec);
    var stats = getMasteryStats(sec);
    if (isSectionMastered(sectionScores) && stats) {
      renderMasteryMilestone(panelEl, stats);
      renderSpeedEvolution(panelEl, stats);
      renderTimelapseAnimation(panelEl, sectionScores, stats);
    }

    renderActivityHeatmap(panelEl, sec);

    renderTrendChart(panelEl, sectionScores);

    var wordWall = getWordWallData(sec);
    renderWordWall(panelEl, wordWall);

    var improvements = getSentenceImprovements(sec);
    renderSentenceList(panelEl, improvements);

    var ai = generateAISummary(sec, sectionScores, improvements, wordWall);
    renderAISummary(panelEl, ai);
  }

  var expandSectionFn = null;
  function setExpandSection(fn) {
    expandSectionFn = fn;
  }

  function toggleProgressPanel(sec) {
    var panel = document.getElementById("historyProgressSec" + sec);
    if (!panel) return;
    if (panel.style.display === "none" || !panel.style.display) {
      if (typeof expandSectionFn === "function") expandSectionFn(sec);
      renderSectionProgressPanel(sec, panel);
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  }

  function bindProgressButtons() {
    var listEl = document.getElementById("historyList");
    if (!listEl) return;
    listEl.querySelectorAll(".section-progress-btn").forEach(function (btn) {
      btn.onclick = function () {
        var sec = parseInt(this.getAttribute("data-sec"), 10);
        if (!isNaN(sec)) toggleProgressPanel(sec);
      };
    });
  }

  window.ProgressPanel = {
    render: renderSectionProgressPanel,
    toggle: toggleProgressPanel,
    bindProgressButtons: bindProgressButtons,
    setExpandSection: setExpandSection
  };
})();
