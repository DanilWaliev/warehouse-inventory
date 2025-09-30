package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type StorageService struct {
	storageModel *mysql.StorageModel
}

func NewStorageService(storageModel *mysql.StorageModel) *StorageService {
	return &StorageService{
		storageModel: storageModel,
	}
}

func (s *StorageService) ReadWithInventoryByIDs(ids []int) ([]*models.Storage, error) {
	var storages []*models.Storage

	for _, id := range ids {
		storage, err := s.storageModel.SelectWithInventoryByID(id)
		if err != nil {
			return nil, err
		}
		storages = append(storages, storage)
	}

	return storages, nil
}

func (s *StorageService) ReadAllWithInventory() ([]*models.Storage, error) {
	return s.storageModel.SelectAllWithInventory()
}

func (s *StorageService) ReadWithoutInventoryByIDs(ids []int) ([]*models.Storage, error) {
	var storages []*models.Storage

	for _, id := range ids {
		storage, err := s.storageModel.SelectWithInventoryByID(id)
		if err != nil {
			return nil, err
		}

		storages = append(storages, storage)
	}

	return storages, nil
}

func (s *StorageService) ReadAllWithoutInventory() ([]*models.Storage, error) {
	return s.storageModel.SelectAllWithoutInventory()
}

func (s *StorageService) CreateWarehouse(location string, stype string, notes string) error {
	return s.storageModel.InsertWarehouse(location, stype, notes)
}

func (s *StorageService) CreateTransitStorage(location string, stype string, transportType string, capacity float64, notes string) error {
	return s.storageModel.InsertTransitStorage(location, stype, transportType, capacity, notes)
}

func (s *StorageService) ReadWithInventoryByTypes(types []string) ([]*models.Storage, error) {
	var storages []*models.Storage

	for _, stype := range types {
		storagesByType, err := s.storageModel.SelectWithInventoryByType(stype)
		if err != nil {
			return nil, err
		}

		storages = append(storages, storagesByType...)
	}

	return storages, nil
}

func (s *StorageService) ReadWithoutInventoryByTypes(types []string) ([]*models.Storage, error) {
	var storages []*models.Storage

	for _, stype := range types {
		storagesByType, err := s.storageModel.SelectWithoutInventoryByType(stype)
		if err != nil {
			return nil, err
		}

		storages = append(storages, storagesByType...)
	}

	return storages, nil
}
