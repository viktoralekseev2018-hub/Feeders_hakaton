// Package main - cmd/mcp-tools/main.go
// Реализация MCP (Model Context Protocol) сервера для инструментов станции «Гелиос-7».
// Предоставляет инструменты поиска по базе знаний (search_knowledge) и расчёта распределения энергии.
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"strings"

	"feeders/internal/agents"
)

type MCPRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type MCPResponse struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id"`
	Result  any    `json:"result,omitempty"`
	Error   any    `json:"error,omitempty"`
}

type CallToolParams struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

func main() {
	reader := bufio.NewReader(os.Stdin)
	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			fmt.Fprintf(os.Stderr, "read error: %v\n", err)
			break
		}

		line = []byte(strings.TrimSpace(string(line)))
		if len(line) == 0 {
			continue
		}

		var req MCPRequest
		if err := json.Unmarshal(line, &req); err != nil {
			sendError(req.ID, -32700, "Parse error")
			continue
		}

		handleRequest(req)
	}
}

func handleRequest(req MCPRequest) {
	switch req.Method {
	case "initialize":
		sendResult(req.ID, map[string]any{
			"protocolVersion": "2024-11-05",
			"serverInfo": map[string]any{
				"name":    "helios-station-mcp-tools",
				"version": "1.0.0",
			},
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
		})

	case "tools/list":
		sendResult(req.ID, map[string]any{
			"tools": []map[string]any{
				{
					"name":        "search_knowledge",
					"description": "Поиск по бортовой научной базе знаний станции «Гелиос-7» (термодинамика реактора, гидропоника оранжереи, протоколы выживания).",
					"inputSchema": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"agent_id": map[string]any{
								"type":        "string",
								"description": "Идентификатор отсека/специалиста: engineer, biologist, captain",
							},
							"query": map[string]any{
								"type":        "string",
								"description": "Ключевые слова или тема запроса",
							},
						},
						"required": []string{"query"},
					},
				},
				{
					"name":        "calculate_power_balance",
					"description": "Расчёт баланса энергосети станции для разрешения дилеммы реактора и оранжереи.",
					"inputSchema": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"pulse_cooling_enabled": map[string]any{
								"type":        "boolean",
								"description": "Включен ли импульсный режим 2 Гц для реактора",
							},
							"night_mode_enabled": map[string]any{
								"type":        "boolean",
								"description": "Включен ли анаэробный ночной режим 430 нм для оранжереи",
							},
						},
					},
				},
				{
					"name":        "start_experiment",
					"description": "Запуск совместного физического эксперимента релятивистских световых часов на станции «Гелиос-7».",
					"inputSchema": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"velocity": map[string]any{
								"type":        "number",
								"description": "Скорость субсветового маневра станции в долях скорости света (0.0 .. 0.8c)",
							},
							"role": map[string]any{
								"type":        "string",
								"description": "Роль наблюдателя: station_observer (на станции) или lab_observer (в лаборатории)",
							},
						},
						"required": []string{"velocity"},
					},
				},
			},
		})

	case "tools/call":
		var params CallToolParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			sendError(req.ID, -32602, "Invalid params")
			return
		}

		switch params.Name {
		case "search_knowledge":
			agentID, _ := params.Arguments["agent_id"].(string)
			query, _ := params.Arguments["query"].(string)
			article, found := agents.FindKnowledge(agentID, query)
			if !found {
				sendResult(req.ID, map[string]any{
					"content": []map[string]any{
						{"type": "text", "text": "Ничего не найдено по данному запросу."},
					},
				})
				return
			}
			sendResult(req.ID, map[string]any{
				"content": []map[string]any{
					{
						"type": "text",
						"text": fmt.Sprintf("ИСТОЧНИК: %s (%s)\nКРАТКО: %s\nЦИТАТА: %s", article.Title, article.Section, article.Summary, article.FullQuote),
					},
				},
			})

		case "calculate_power_balance":
			pulse, _ := params.Arguments["pulse_cooling_enabled"].(bool)
			night, _ := params.Arguments["night_mode_enabled"].(bool)

			reactorMW := 15.0
			if pulse {
				reactorMW = 9.0
			}

			bioMW := 12.0
			if night {
				bioMW = 5.0
			}

			baseStationMW := 4.0
			totalMW := reactorMW + bioMW + baseStationMW
			capacityMW := 20.0
			surplusMW := capacityMW - totalMW
			sustainable := surplusMW >= 0

			resultText := fmt.Sprintf(
				"Потребление: Реактор: %.1f МВт, Оранжерея: %.1f МВт, Системы станции: %.1f МВт. Сумма: %.1f МВт. Резерв: %.1f МВт. Баланс: %s",
				reactorMW, bioMW, baseStationMW, totalMW, capacityMW,
				map[bool]string{true: "СТАБИЛЬНО (Станция спасена!)", false: "КРИТИЧЕСКИЙ ПЕРЕРАСХОД (Коллапс сети)"}[sustainable],
			)

			sendResult(req.ID, map[string]any{
				"content": []map[string]any{
					{"type": "text", "text": resultText},
				},
			})

		case "start_experiment":
			vRaw, ok := params.Arguments["velocity"].(float64)
			if !ok {
				vRaw = 0.6
			}
			if vRaw < 0.0 {
				vRaw = 0.0
			}
			if vRaw > 0.8 {
				vRaw = 0.8
			}

			role, _ := params.Arguments["role"].(string)
			if role == "" {
				role = "station_observer"
			}

			// Релятивистский фактор Лоренца: gamma = 1 / sqrt(1 - v^2/c^2)
			gamma := 1.0 / math.Sqrt(1.0-vRaw*vRaw)
			dilationPercent := (gamma - 1.0) * 100.0

			summary := fmt.Sprintf(
				"Эксперимент световых часов запущен: скорость v = %.2fc, фактор Лоренца γ = %.4f. Замедление хода бортовых часов: +%.1f%% относительно неподвижного наблюдателя (роль: %s).",
				vRaw, gamma, dilationPercent, role,
			)

			sendResult(req.ID, map[string]any{
				"content": []map[string]any{
					{"type": "text", "text": summary},
				},
				"data": map[string]any{
					"velocity": vRaw,
					"gamma":    gamma,
					"role":     role,
				},
			})

		default:
			sendError(req.ID, -32601, "Tool not found")
		}

	default:
		sendError(req.ID, -32601, "Method not found")
	}
}

func sendResult(id any, result any) {
	resp := MCPResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	}
	b, _ := json.Marshal(resp)
	fmt.Println(string(b))
}

func sendError(id any, code int, message string) {
	resp := MCPResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: map[string]any{
			"code":    code,
			"message": message,
		},
	}
	b, _ := json.Marshal(resp)
	fmt.Println(string(b))
}
