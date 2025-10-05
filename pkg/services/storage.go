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

func (s *StorageService) CreateWarehouse(name string, location string, notes string) error {
	return s.storageModel.InsertWarehouse(name, location, notes)
}

func (s *StorageService) CreateTransitStorage(name string, location string, stype string, transportType string, capacity float64, notes string) error {
	return s.storageModel.InsertTransitStorage(name, location, stype, transportType, capacity, notes)
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

func (s *StorageService) UpdateWarehouse(id int, name string, location string, notes string) error {
	return s.storageModel.UpdateWarehouse(id, name, location, notes)
}

func (s *StorageService) UpdateTransitStorage(id int, name string, location string, transportType string, capacity float64, notes string) error {
	return s.storageModel.UpdateTransitStorage(id, name, location, transportType, capacity, notes)
}

func (s *StorageService) Delete(id int) error {
	storage, err := s.storageModel.SelectWithoutInventoryByID(id)
	if err != nil {
		return err
	}

	if storage.Type == "warehouse" {
		return s.storageModel.DeleteWarehouse(id)
	} else {
		return s.storageModel.DeleteTransitStorage(id)
	}
}
