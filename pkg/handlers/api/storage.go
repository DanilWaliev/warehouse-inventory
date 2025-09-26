package api

import (
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/services"
)

type StorageHandler struct {
	Helper           *handlers.LogHelper
	WarehouseService *services.StorageService
}

func NewStorageHandler(helper *handlers.LogHelper, storageService *services.StorageService) *StorageHandler {
	return &StorageHandler{
		Helper:           helper,
		WarehouseService: storageService,
	}
}
