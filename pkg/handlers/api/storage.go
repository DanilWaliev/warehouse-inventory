package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
)

type StorageHandler struct {
	Helper         *handlers.LogHelper
	StorageService *services.StorageService
}

func NewStorageHandler(helper *handlers.LogHelper, storageService *services.StorageService) *StorageHandler {
	return &StorageHandler{
		Helper:         helper,
		StorageService: storageService,
	}
}

func (h *StorageHandler) Get(w http.ResponseWriter, r *http.Request) {
	var (
		ids       []int
		inventory bool
		types     []string
	)

	// Получаем id
	for _, idStr := range r.URL.Query()["id"] {
		id, err := strconv.Atoi(idStr)
		if err != nil || id <= 0 {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		ids = append(ids, id)
	}

	// Получаем флаг
	if r.URL.Query().Get("inventory") == "true" {
		inventory = true
	} else {
		inventory = false
	}

	// Получаем типы
	types = append(types, r.URL.Query()["type"]...)

	var (
		storages []*models.Storage
		err      error
	)

	// Обрабатываемые комбинации параметров:
	switch {
	case len(ids) > 0 && inventory && len(types) <= 0:
		storages, err = h.StorageService.ReadWithInventoryByIDs(ids)
	case len(ids) <= 0 && inventory && len(types) <= 0:
		storages, err = h.StorageService.ReadAllWithInventory()
	case len(ids) > 0 && !inventory && len(types) <= 0:
		storages, err = h.StorageService.ReadWithoutInventoryByIDs(ids)
	case len(ids) <= 0 && !inventory && len(types) <= 0:
		storages, err = h.StorageService.ReadAllWithoutInventory()
	case len(ids) <= 0 && inventory && len(types) > 0:
		storages, err = h.StorageService.ReadWithInventoryByTypes(types)
	case len(ids) <= 0 && !inventory && len(types) > 0:
		storages, err = h.StorageService.ReadWithoutInventoryByTypes(types)
	default:
		h.Helper.ClientError(w, http.StatusBadRequest)
	}

	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}

	if len(storages) == 0 {
		h.Helper.NotFound(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(storages); err != nil {
		h.Helper.ServerError(w, err)
		return
	}
}

func (h *StorageHandler) Post(w http.ResponseWriter, r *http.Request) {
	var NewStorage struct {
		Type          string  `json:"type"`
		Name          string  `json:"name"`
		Location      string  `json:"location"`
		TransportType string  `json:"transportType"`
		Capacity      float64 `json:"capacity"`
		Notes         string  `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&NewStorage); err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	switch NewStorage.Type {
	case "warehouse":
		err := h.StorageService.CreateWarehouse(NewStorage.Name, NewStorage.Location, NewStorage.Notes)
		if err != nil {
			h.Helper.ServerError(w, err)
			return
		}
	case "transitstorage":
		err := h.StorageService.CreateTransitStorage(NewStorage.Name, NewStorage.Location, NewStorage.Type, NewStorage.TransportType, NewStorage.Capacity, NewStorage.Notes)
		if err != nil {
			h.Helper.ServerError(w, err)
			return
		}
	default:
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}
}
