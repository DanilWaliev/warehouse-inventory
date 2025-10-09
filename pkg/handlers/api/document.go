package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/handlers/auth"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
	"warehouse-inventory/pkg/sqlerr"
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

	var storages []int // id складов
	for _, storageStr := range r.URL.Query()["storage"] {
		storage, err := strconv.Atoi(storageStr)
		if err != nil {
			h.Helper.ServerError(w, err)
		}

		storages = append(storages, storage)
	}

	// Валидация
	if (len(ids) > 0 && (len(types) > 0 || len(storages) > 0)) ||
		(len(types) > 0 && (len(ids) > 0 || len(storages) > 0)) ||
		(len(storages) > 0 && (len(ids) > 0 || len(types) > 0)) {
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
	case len(storages) > 0:
		documents, err = h.DocumentService.ReadByStorages(storages)
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
		StorageId   int    `json:"storageId"`
		ComponentID int    `json:"componentId"`
		Quantity    int    `json:"quantity"`
		Notes       string `json:"notes"`
	}

	var newDoc *models.Document

	err := json.NewDecoder(r.Body).Decode(&newDocInput)
	if err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Получаем данные об отправителе
	senderUser := r.Context().Value(auth.UserContextKey).(*auth.AuthorizedUser)

	// Парсинг в зависимости от типа документа
	switch docType {
	case "buy":
		newDoc = &models.Document{
			Type:      "buy",
			CreatedBy: senderUser.ID,
			Notes:     newDocInput.Notes,
			StorageID: &newDocInput.StorageId,
			Items: []models.DocumentItem{{
				Component: models.Component{ID: newDocInput.ComponentID},
				Quantity:  newDocInput.Quantity,
			}},
		}

		err = h.DocumentService.Create(newDoc)
	case "sale":
		newDoc = &models.Document{
			Type:      "sale",
			CreatedBy: senderUser.ID,
			Notes:     newDocInput.Notes,
			StorageID: &newDocInput.StorageId,
			Items: []models.DocumentItem{{
				Component: models.Component{ID: newDocInput.ComponentID},
				Quantity:  newDocInput.Quantity,
			}},
		}

		err = h.DocumentService.Create(newDoc)
	default:
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	if err != nil {
		if sqlerr.Is(err, sqlerr.ErrDuplicateEntry) {
			h.Helper.ClientError(w, http.StatusConflict)
		} else if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
			h.Helper.ClientError(w, http.StatusBadRequest)
		} else {
			h.Helper.ServerError(w, err)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}
