package fraud

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

var (
	ErrMLServiceUnavailable = errors.New("fraud ML inference service is unavailable or timed out")
)

type FraudClient struct {
	baseURL    string
	httpClient *http.Client
	timeout    time.Duration
}

func NewFraudClient(baseURL string, timeout time.Duration) *FraudClient {
	if timeout <= 0 {
		timeout = 150 * time.Millisecond
	}
	return &FraudClient{
		baseURL: baseURL,
		timeout: timeout,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *FraudClient) ScoreTransaction(ctx context.Context, req FraudScoreRequest) (*FraudScoreResponse, error) {
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal fraud request: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/fraud/score", c.baseURL)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to construct fraud request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMLServiceUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: service returned HTTP %d", ErrMLServiceUnavailable, resp.StatusCode)
	}

	var scoreResp FraudScoreResponse
	if err := json.NewDecoder(resp.Body).Decode(&scoreResp); err != nil {
		return nil, fmt.Errorf("failed to decode fraud score response: %w", err)
	}

	return &scoreResp, nil
}
