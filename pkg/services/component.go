package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

// TODO: заменить конкретные типы на интерфейсы

type ComponentService struct {
	componentModel *mysql.ComponentModel
}

func NewComponentService(componentModel *mysql.ComponentModel) *ComponentService {
	return &ComponentService{
		componentModel: componentModel,
	}
}

func (s *ComponentService) GetAll() ([]*models.Component, error) {
	return s.componentModel.GetAll()
}
