package api

import (
	"net/http"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/services"
)

type DocumentHandler struct {
	Helper          *handlers.LogHelper
	DocumentService *services.DocumentService
}

func NewDocumentHandler(helper *handlers.LogHelper, documentService *services.DocumentService) *DocumentHandler {
	return &DocumentHandler{
		Helper:          helper,
		DocumentService: documentService,
	}
}

func (h *DocumentHandler) Get(w http.ResponseWriter, r *http.Request) {

}
