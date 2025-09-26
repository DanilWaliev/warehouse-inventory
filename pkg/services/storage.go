package services

import "warehouse-inventory/pkg/models/mysql"

type StorageService struct {
	storageModel *mysql.StorageModel
}

func NewStorageService(storageModel *mysql.StorageModel) *StorageService {
	return &StorageService{
		storageModel: storageModel,
	}
}
