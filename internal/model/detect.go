package model

// Box is one detected checkbox in pixel coordinates of the source image.
type Box struct {
	BBox      [4]int `json:"bbox"`
	IsChecked bool   `json:"is_checked"`
}

// DetectResponse is the JSON body for POST /detect.
type DetectResponse struct {
	DetectorVersion string `json:"detector_version,omitempty"`
	ImageWidth      int    `json:"image_width,omitempty"`
	ImageHeight     int    `json:"image_height,omitempty"`
	Boxes             []Box  `json:"boxes"`
}
