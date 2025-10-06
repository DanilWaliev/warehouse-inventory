package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/models"
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
	types := r.URL.Query()["type"]

	var ids []int
	for _, idStr := range r.URL.Query()["id"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ServerError(w, err)
		}

		ids = append(ids, id)
	}

	// Валидация
	if len(types) > 0 && len(ids) > 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
	}

	var (
		documents []*models.Document
		err       error
	)

	switch {
	case len(types) > 0:
		documents, err = h.DocumentService.ReadByTypes(types)
	case len(ids) > 0:
		documents, err = h.DocumentService.ReadByIDs(ids)
	default:
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}

	if len(documents) == 0 {
		h.Helper.ClientError(w, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err = json.NewEncoder(w).Encode(documents); err != nil {
		h.Helper.ServerError(w, err)
		return
	}
}

func (h *DocumentHandler) Post(w http.ResponseWriter, r *http.Request) {
	docType := r.URL.Query().Get("type")

	var newDocInput struct {
		StorageId int    `json:"storageId"`
		CreatedBy int    `json:"createdBy"`
		Notes     string `json:"notes"`
		Items     []struct {
			ComponentID int `json:"componentId"`
			Quantity    int `json:"quantity"`
		}
	}

	var (
		newDoc      *models.Document
		newDocItems []models.DocumentItem
	)

	// Парсимм позиции в срез DocumentItem
	for _, inputItem := range newDocInput.Items {
		newItem := models.DocumentItem{
			Component: models.Component{
				ID: inputItem.ComponentID,
			},
			Quantity: inputItem.Quantity,
		}

		newDocItems = append(newDocItems, newItem)
	}

	// Парсинг в зависимости от типа документа
	var err error
	switch docType {
	case "buy":
		newDoc = &models.Document{
			Type:      "buy",
			CreatedBy: r.Context().Value("ID").(int),
			Notes:     newDocInput.Notes,
			StorageID: &newDocInput.StorageId,
			Items:     newDocItems,
		}

		err = h.DocumentService.Create(newDoc)
	case "sale":
		newDoc = &models.Document{
			Type:      "sale",
			CreatedBy: r.Context().Value("ID").(int),
			Notes:     newDocInput.Notes,
			StorageID: &newDocInput.StorageId,
			Items:     newDocItems,
		}

		err = h.DocumentService.Create(newDoc)
	default:
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}
