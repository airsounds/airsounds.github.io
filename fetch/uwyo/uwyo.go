package uwyo

import (
	"bufio"
	"bytes"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/html"
)

const soundingURL = "http://weather.uwyo.edu/cgi-bin/sounding"

var timezone, _ = time.LoadLocation("Asia/Jerusalem")

// UWYO forcast information.
type UWYO struct {
	// Time of Forecast
	Time    time.Time
	Station int
	// Pressure in hPa
	Pressure []int
	// Height in feet
	Height []int
	// Temp in Deg C
	Temp []float32
	// Dew point in deg C
	Dew []float32
	// WindDir in degrees
	WindDir []int
	// WindSpeed in knots
	WindSpeed []int
}

func Fetch(station int, t time.Time) ([]*UWYO, error) {
	// Measurement are only available in 12 hours periods, at 00 and 12.
	hour := "00"
	if t.Hour() > 12 {
		hour = "12"
	}
	req, err := http.NewRequest(http.MethodGet, soundingURL, nil)
	if err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Set("region", "mideast")
	q.Set("STNM", strconv.Itoa(station)) // Bet dagan station.
	q.Set("TYPE", "TEXT:LIST")
	q.Set("YEAR", fmt.Sprintf("%4d", t.Year()))
	q.Set("MONTH", fmt.Sprintf("%02d", t.Month()))
	q.Set("FROM", fmt.Sprintf("%02d%s", t.Day(), hour))
	q.Set("TO", fmt.Sprintf("%02d%s", t.Day(), hour))
	req.URL.RawQuery = q.Encode()

	log.Printf("Fetching from URL %s", req.URL)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	doc, err := html.Parse(resp.Body)
	if err != nil {
		return nil, err
	}

	// Look for BODY node.
	body, err := findElement(doc.FirstChild.FirstChild, "body")
	if err != nil {
		return nil, err
	}

	n := body.FirstChild
	var tables []*UWYO
	for {
		headerNode, err := findElement(n, "h2")
		if err != nil {
			log.Println(err)
			break
		}
		tableNode, err := findElement(headerNode, "pre")
		if err != nil {
			log.Println(err)
			break
		}
		n = tableNode.NextSibling
		table, err := parseTable(headerNode, tableNode)
		if err != nil {
			return nil, err
		}
		if table == nil {
			break
		}
		tables = append(tables, table)
	}

	return tables, nil
}

func parseTable(headerNode *html.Node, tableNode *html.Node) (*UWYO, error) {
	var (
		table UWYO
		err   error
	)

	text := headerNode.FirstChild
	if text.Type != html.TextNode {
		return nil, fmt.Errorf("expected text node within the h2 node")
	}
	table.Time, err = parseHeader(text.Data)
	if err != nil {
		return nil, fmt.Errorf("parsing header: %s", err)
	}

	tableText := tableNode.FirstChild.Data
	log.Println("Table:", tableText)
	s := bufio.NewScanner(bytes.NewBufferString(tableText))
	// Skip header:
	for i := 0; i < 4; i++ {
		s.Scan()
	}

	// Scan table content.
	for s.Scan() {
		parts := strings.Fields(s.Text())
		if len(parts) != 11 {
			continue
		}
		appendInt(&table.Pressure, parts[0], 1)
		appendInt(&table.Height, parts[1], 3.28084) // Convert meters to feet.
		appendFloat(&table.Temp, parts[2], 1)
		appendFloat(&table.Dew, parts[3], 1)
		appendInt(&table.WindDir, parts[4], 1)
		appendInt(&table.WindSpeed, parts[5], 1)
	}
	return &table, s.Err()
}

func parseHeader(s string) (time.Time, error) {
	i := strings.Index(s, " at ")
	if i == -1 {
		return time.Time{}, fmt.Errorf("didn't find 'at' in: %s", s)
	}
	s = s[i+4:]
	t, err := time.ParseInLocation("15Z 02 Jan 2006", s, timezone)
	if err != nil {
		return t, err
	}
	return t, nil
}

func findElement(n *html.Node, tag string) (*html.Node, error) {
	for n != nil {
		log.Printf("Checking %v: %s", n.Type, n.Data)
		if n.Type == html.ElementNode && n.Data == tag {
			log.Printf("Found <%s>", tag)
			return n, nil
		}
		n = n.NextSibling
	}
	return nil, fmt.Errorf("didn't find '%s' node", tag)
}

func appendInt(a *[]int, s string, scale float32) error {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return err
	}
	*a = append(*a, int(float32(v)*scale))
	return nil
}

func appendFloat(a *[]float32, s string, scale float32) error {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return err
	}
	*a = append(*a, float32(v)*scale)
	return nil
}
