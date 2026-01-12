"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dailySuggestions,
  findTopicByAlias,
  getAllQuizQuestions,
  glossary,
  lookupGlossary,
  matchQuestionToTopic,
  motivationalTips,
  searchTopics,
  studyRoadmap,
  topics,
  type QuizQuestion,
  type Topic,
} from "@/data/knowledge";

type HistoryRole = "system" | "user" | "assistant";

type HistoryEntry = {
  id: string;
  role: HistoryRole;
  content: string[];
};

type PendingState =
  | null
  | {
      type: "quiz";
      question: QuizQuestion;
      attempts: number;
      revealedHint: boolean;
    };

type SessionStats = {
  answered: number;
  correct: number;
  streak: number;
};

const initialHistory: HistoryEntry[] = [
  {
    id: "boot-message",
    role: "system",
    content: [
      "Inicializando Terminal Mentor v1.0 ...",
      "🛡️ Asistente interactivo para aprender y practicar ciberseguridad.",
      "Escribe `help` para ver comandos disponibles o `topics` para explorar rutas de estudio.",
    ],
  },
];

const helpCards = [
  { command: "help", description: "Muestra los comandos disponibles." },
  { command: "topics", description: "Lista temáticas principales y resumen." },
  { command: "lesson <tema>", description: "Explica un tema en profundidad." },
  { command: "resources [tema]", description: "Recursos recomendados por tema." },
  { command: "labs [tema]", description: "Laboratorios prácticos guiados." },
  { command: "quiz [tema]", description: "Pregunta de repaso con opción a pista." },
  { command: "glossary <término>", description: "Definición rápida de conceptos." },
  { command: "question <tu duda>", description: "Consulta libre con contexto." },
  { command: "search <palabra>", description: "Busca temas relacionados." },
  { command: "roadmap", description: "Ruta de aprendizaje sugerida." },
  { command: "suggest", description: "Actividad del día para practicar." },
  { command: "status", description: "Estadísticas de sesión y motivación." },
  { command: "clear", description: "Limpia el historial de la terminal." },
];

const MAX_HISTORY_COMMANDS = 30;

const formatList = (title: string, items: string[]) => [
  `# ${title}`,
  ...items.map((item, index) => `  ${index + 1}. ${item}`),
];

const formatBullets = (items: string[]) => items.map((item) => `• ${item}`);

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeInput = (value: string) => value.trim();

export default function HomePage() {
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);
  const [inputValue, setInputValue] = useState("");
  const [pendingState, setPendingState] = useState<PendingState>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    answered: 0,
    correct: 0,
    streak: 0,
  });
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const screenRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyIndexRef = useRef<number | null>(null);

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addEntry = useCallback((role: HistoryRole, content: string | string[]) => {
    const lines = Array.isArray(content) ? content : [content];
    setHistory((prev) => [...prev, { id: makeId(), role, content: lines }]);
  }, []);

  const showAssistant = useCallback(
    (lines: string[]) => {
      addEntry("assistant", lines);
    },
    [addEntry],
  );

  const resetTerminal = useCallback(() => {
    setHistory(initialHistory);
    setPendingState(null);
    showAssistant(["Pantalla limpia. Continuemos."]);
  }, [showAssistant]);

  const buildSessionStatus = useCallback((stats: SessionStats) => {
    const accuracy =
      stats.answered === 0 ? 0 : Math.round((stats.correct / stats.answered) * 100);
    return `📊 Sesión | Resueltas: ${stats.answered} | Correctas: ${stats.correct} | Precisión: ${accuracy}% | Racha: ${stats.streak}`;
  }, []);

  const handleQuizAnswer = useCallback(
    (value: string) => {
      if (!pendingState || pendingState.type !== "quiz") {
        return;
      }

      const normalized = value.trim().toLowerCase();
      const { question } = pendingState;

      if (normalized === "hint" || normalized === "pista") {
        if (pendingState.revealedHint) {
          showAssistant([
            "⚠️ Ya mostré una pista para esta pregunta. Intenta una respuesta.",
          ]);
          return;
        }
        setPendingState({
          ...pendingState,
          revealedHint: true,
        });
        showAssistant([
          `Pista: ${question.answer.slice(0, Math.ceil(question.answer.length / 2))}...`,
        ]);
        return;
      }

      if (normalized === "skip" || normalized === "omitir") {
        const updatedStats: SessionStats = {
          answered: sessionStats.answered + 1,
          correct: sessionStats.correct,
          streak: 0,
        };
        showAssistant([
          `Pregunta omitida. Respuesta correcta: ${question.answer}`,
          `Explicación: ${question.explanation}`,
          buildSessionStatus(updatedStats),
        ]);
        setPendingState(null);
        setSessionStats(updatedStats);
        return;
      }

      const isCorrect = normalized === question.answer.toLowerCase();

      if (isCorrect) {
        const updatedStats: SessionStats = {
          answered: sessionStats.answered + 1,
          correct: sessionStats.correct + 1,
          streak: sessionStats.streak + 1,
        };
        showAssistant([
          "✅ ¡Correcto!",
          `Explicación: ${question.explanation}`,
          buildSessionStatus(updatedStats),
          "Escribe `quiz` para otra pregunta o explora con `lesson <tema>`.",
        ]);
        setPendingState(null);
        setSessionStats(updatedStats);
      } else {
        const attempts = pendingState.attempts + 1;
        if (attempts >= 2) {
          const updatedStats: SessionStats = {
            answered: sessionStats.answered + 1,
            correct: sessionStats.correct,
            streak: 0,
          };
          showAssistant([
            "❌ Respuesta incorrecta.",
            `La respuesta correcta es: ${question.answer}`,
            `Explicación: ${question.explanation}`,
            buildSessionStatus(updatedStats),
            "Puedes escribir `quiz` para intentar otra o `lesson <tema>` para repasar.",
          ]);
          setPendingState(null);
          setSessionStats(updatedStats);
        } else {
          showAssistant([
            "Respuesta incorrecta. Puedes intentar nuevamente, pedir `hint` o escribir `skip`.",
          ]);
          setPendingState({ ...pendingState, attempts });
        }
      }
    },
    [pendingState, sessionStats, showAssistant, buildSessionStatus],
  );

  const summarizeTopic = (topic: Topic) => [
    `== ${topic.title.toUpperCase()} ==`,
    topic.summary,
    "",
    "Fundamentos clave:",
    ...formatBullets(topic.fundamentals),
    "",
    "Nivel intermedio/avanzado:",
    ...formatBullets(topic.advanced),
    "",
    "Quick wins:",
    ...formatBullets(topic.quickWins),
    "",
    "Alertas tempranas:",
    ...formatBullets(topic.warningSigns),
    "",
    "Ruta sugerida:",
    ...formatBullets(topic.studyPath),
  ];

  const formatResources = (topic?: Topic) => {
    if (!topic) {
      const lines: string[] = ["🔗 Recursos recomendados por temática:"];
      topics.forEach((item) => {
        lines.push(`> ${item.title}`);
        item.resources.forEach((resource) => {
          lines.push(`  - ${resource.title}: ${resource.url}`);
        });
      });
      return lines;
    }

    return [
      `Recursos para ${topic.title}:`,
      ...topic.resources.map((resource) => `- ${resource.title}: ${resource.url} (${resource.description})`),
    ];
  };

  const formatLabs = (topic?: Topic) => {
    if (!topic) {
      const lines = ["🧪 Laboratorios disponibles:"];
      topics.forEach((item) => {
        item.labs.forEach((lab) => {
          lines.push(
            `[${item.title}] ${lab.title} (${lab.difficulty} · ${lab.time}) -> ${lab.goal}`,
          );
        });
      });
      lines.push("Usa `labs <tema>` para ver pasos detallados.");
      return lines;
    }

    if (topic.labs.length === 0) {
      return [`Aún no hay laboratorios documentados para ${topic.title}.`];
    }

    const lab = topic.labs[0];
    return [
      `🧪 ${lab.title} | Dificultad: ${lab.difficulty} | Duración: ${lab.time}`,
      `Objetivo: ${lab.goal}`,
      "",
      "Pasos:",
      ...formatBullets(lab.steps),
      "",
      "Checklist de éxito:",
      ...formatBullets(lab.checklist),
    ];
  };

  const pickQuizQuestion = (topicAlias?: string): QuizQuestion | null => {
    if (topicAlias) {
      const matchingTopic = findTopicByAlias(topicAlias);
      if (matchingTopic && matchingTopic.quiz.length > 0) {
        return matchingTopic.quiz[Math.floor(Math.random() * matchingTopic.quiz.length)];
      }
    }
    const questions = getAllQuizQuestions();
    if (questions.length === 0) return null;
    return questions[Math.floor(Math.random() * questions.length)];
  };

  const answerNaturalQuestion = (query: string) => {
    const topic = matchQuestionToTopic(query) ?? topics[0];
    return [
      `Tema sugerido: ${topic.title}`,
      `Resumen: ${topic.summary}`,
      "",
      "Puntos clave:",
      ...formatBullets(topic.fundamentals.slice(0, 3)),
      "",
      "Recomendación:",
      "• Revisa la lección con `lesson " + topic.id + "`.",
      "• Programa un laboratorio práctico con `labs " + topic.id + "`.",
    ];
  };

  const handleCommand = useCallback(
    (rawInput: string) => {
      const trimmed = normalizeInput(rawInput);
      if (!trimmed) return;

      const [command, ...argsParts] = trimmed.split(" ");
      const commandKey = command.toLowerCase();
      const argString = argsParts.join(" ").trim();

      switch (commandKey) {
        case "help":
        case "?": {
          const lines = ["Comandos disponibles:"];
          helpCards.forEach((card) => {
            lines.push(`${card.command.padEnd(18, " ")} - ${card.description}`);
          });
          showAssistant(lines);
          break;
        }
        case "topics": {
          const lines = ["Temas activos:"];
          topics.forEach((topic) => {
            lines.push(
              `${topic.id.padEnd(12, " ")} | ${topic.title} -> ${topic.summary}`,
            );
          });
          lines.push("Explora detalles con `lesson <tema>`.");
          showAssistant(lines);
          break;
        }
        case "lesson":
        case "tema":
        case "topic": {
          if (!argString) {
            showAssistant(["Debes indicar un tema. Ejemplo: `lesson redes`"]);
            return;
          }
          const topic = findTopicByAlias(argString);
          if (!topic) {
            const related = searchTopics(argString);
            if (related.length === 0) {
              showAssistant([
                `No encontré un tema llamado "${argString}". Usa \`topics\` para ver opciones.`,
              ]);
              return;
            }
            showAssistant([
              `No encontré coincidencia exacta. ¿Quizás buscas alguno de estos?`,
              ...related.map((item) => `- ${item.id}: ${item.title}`),
            ]);
            return;
          }
          showAssistant(summarizeTopic(topic));
          break;
        }
        case "resources":
        case "recursos": {
          const topic = argString ? findTopicByAlias(argString) : undefined;
          showAssistant(formatResources(topic));
          break;
        }
        case "labs":
        case "lab": {
          const topic = argString ? findTopicByAlias(argString) : undefined;
          showAssistant(formatLabs(topic));
          break;
        }
        case "quiz":
        case "reto": {
          const question = pickQuizQuestion(argString);
          if (!question) {
            showAssistant(["No hay preguntas disponibles por ahora."]);
            return;
          }
          showAssistant([
            `Pregunta: ${question.prompt}`,
            ...(question.choices ? [`Opciones: ${question.choices.join(" | ")}`] : []),
            "Responde, pide `hint` para una pista o escribe `skip` para saltar.",
          ]);
          setPendingState({
            type: "quiz",
            question,
            attempts: 0,
            revealedHint: false,
          });
          break;
        }
        case "glossary":
        case "glosario": {
          if (!argString) {
            showAssistant(
              glossary.map((entry) => `${entry.term}: ${entry.definition}`),
            );
            return;
          }
          const entry = lookupGlossary(argString);
          if (!entry) {
            showAssistant([
              `No encontré "${argString}". Usa \`glossary\` para listar conceptos.`,
            ]);
            return;
          }
          showAssistant([
            `${entry.term}: ${entry.definition}`,
            `Contexto: ${entry.context}`,
          ]);
          break;
        }
        case "search":
        case "buscar": {
          if (!argString) {
            showAssistant(["Incluye un término. Ejemplo: `search mitre`"]);
            return;
          }
          const results = searchTopics(argString);
          if (results.length === 0) {
            showAssistant([
              `No hay coincidencias para "${argString}". Intenta con otro término.`,
            ]);
          } else {
            const lines = [`Resultados (${results.length}):`];
            results.forEach((result) =>
              lines.push(`${result.id} -> ${result.title} | ${result.summary}`),
            );
            showAssistant(lines);
          }
          break;
        }
        case "roadmap":
        case "ruta": {
          showAssistant(formatList("Ruta sugerida de 6 semanas", studyRoadmap));
          break;
        }
        case "suggest":
        case "actividad": {
          const suggestion =
            dailySuggestions[Math.floor(Math.random() * dailySuggestions.length)];
          showAssistant([
            `Actividad recomendada: ${suggestion}`,
            "Comparte conclusiones en tu bitácora personal.",
          ]);
          break;
        }
        case "status": {
          const motivation =
            motivationalTips[Math.floor(Math.random() * motivationalTips.length)];
          showAssistant([buildSessionStatus(sessionStats), `💡 ${motivation}`]);
          break;
        }
        case "question":
        case "pregunta": {
          if (!argString) {
            showAssistant([
              "Formula tu duda. Ejemplo: `question diferencia entre ids e ips`.",
            ]);
            return;
          }
          showAssistant(answerNaturalQuestion(argString));
          break;
        }
        case "clear":
        case "cls": {
          resetTerminal();
          break;
        }
        default: {
          showAssistant([
            `Comando desconocido: ${commandKey}`,
            "Escribe `help` para ver opciones disponibles.",
          ]);
        }
      }
    },
    [
      showAssistant,
      resetTerminal,
      sessionStats,
      buildSessionStatus,
    ],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = normalizeInput(inputValue);
      if (!normalized) return;

      addEntry("user", normalized);
      setCommandHistory((prev) => {
        const updated = [normalized, ...prev.filter((item) => item !== normalized)];
        return updated.slice(0, MAX_HISTORY_COMMANDS);
      });
      historyIndexRef.current = null;
      setInputValue("");

      if (pendingState && pendingState.type === "quiz") {
        handleQuizAnswer(normalized);
        return;
      }

      handleCommand(normalized);
    },
    [addEntry, handleCommand, handleQuizAnswer, inputValue, pendingState],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const current = historyIndexRef.current;
      const nextIndex =
        current === null ? 0 : Math.min(current + 1, commandHistory.length - 1);
      const nextValue = commandHistory[nextIndex];
      if (nextValue) {
        setInputValue(nextValue);
        historyIndexRef.current = nextIndex;
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const current = historyIndexRef.current;
      if (current === null) {
        return;
      }
      if (current <= 0) {
        setInputValue("");
        historyIndexRef.current = null;
        return;
      }
      const nextIndex = current - 1;
      const nextValue = commandHistory[nextIndex];
      if (nextValue) {
        setInputValue(nextValue);
      }
      historyIndexRef.current = nextIndex;
    }
  };

  return (
    <div className="terminal">
      <header className="terminal__header">
        <div className="header__lights">
          <span className="header__light" style={{ color: "#f87171" }} />
          <span className="header__light" style={{ color: "#fbbf24" }} />
          <span className="header__light" style={{ color: "#34d399" }} />
        </div>
        <div className="header__title">Terminal Mentor · Aprendizaje guiado</div>
        <div className="status-bar">
          <span className="status-badge">Modo: Aprendizaje activo</span>
          <span className="status-badge">
            Sesión: {sessionStats.answered} preguntas
          </span>
        </div>
      </header>

      <div className="terminal__screen" ref={screenRef}>
        {history.map((entry) => (
          <div key={entry.id} className={`line line--${entry.role}`}>
            {entry.role === "user" ? (
              <span>
                <span className="prompt">usuario@mentor:~$</span>
                <span>{entry.content.join(" ")}</span>
              </span>
            ) : (
              entry.content.map((line, index) => <div key={index}>{line}</div>)
            )}
          </div>
        ))}
        {pendingState?.type === "quiz" && (
          <div className="line line--assistant">
            <div>
              Pregunta activa: {pendingState.question.prompt}
              {pendingState.question.choices &&
                ` → Opciones: ${pendingState.question.choices.join(" | ")}`}
            </div>
            <div>
              Intenta responder, escribe <code>hint</code> para una pista o{" "}
              <code>skip</code> para saltar.
            </div>
          </div>
        )}
      </div>

      <form className="terminal__input" onSubmit={handleSubmit}>
        <label htmlFor="command">usuario@mentor:~$</label>
        <input
          id="command"
          ref={inputRef}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          placeholder={pendingState ? "Responde la pregunta..." : "Escribe un comando..."}
        />
      </form>
    </div>
  );
}
