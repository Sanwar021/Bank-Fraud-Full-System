package investigation

import (
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type SSEHub struct {
	mu      sync.RWMutex
	clients map[chan []byte]bool
}

var GlobalSSEHub = &SSEHub{
	clients: make(map[chan []byte]bool),
}

func (h *SSEHub) AddClient(ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[ch] = true
}

func (h *SSEHub) RemoveClient(ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
}

func (h *SSEHub) Broadcast(eventType string, data interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	payload, err := json.Marshal(data)
	if err != nil {
		return
	}

	msg := fmt.Sprintf("event: %s\ndata: %s\n\n", eventType, string(payload))
	b := []byte(msg)

	for ch := range h.clients {
		select {
		case ch <- b:
		default:
		}
	}
}

func HandleSSE(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

	clientChan := make(chan []byte, 10)
	GlobalSSEHub.AddClient(clientChan)
	defer GlobalSSEHub.RemoveClient(clientChan)

	// Send initial heartbeat
	initMsg := fmt.Sprintf("event: connected\ndata: {\"status\":\"connected\",\"timestamp\":\"%s\"}\n\n", time.Now().UTC().Format(time.RFC3339))
	_, _ = c.Writer.Write([]byte(initMsg))
	c.Writer.Flush()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	c.Stream(func(w io.Writer) bool {
		select {
		case msg, ok := <-clientChan:
			if !ok {
				return false
			}
			_, err := w.Write(msg)
			return err == nil
		case <-ticker.C:
			heartbeat := fmt.Sprintf("event: ping\ndata: {\"time\":\"%s\"}\n\n", time.Now().UTC().Format(time.RFC3339))
			_, err := w.Write([]byte(heartbeat))
			return err == nil
		case <-c.Request.Context().Done():
			return false
		}
	})
}

