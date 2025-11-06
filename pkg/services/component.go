package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type ComponentService struct {
	componentModel *mysql.ComponentModel
}

func NewComponentService(componentModel *mysql.ComponentModel) *ComponentService {
	return &ComponentService{
		componentModel: componentModel,
	}
}

// Возвращает все компоненты
func (s *ComponentService) ReadAll() ([]*models.Component, error) {
	return s.componentModel.SelectAll()
}

// Возвращает все компоненты с указанными типами
func (s *ComponentService) ReadByTypes(types []string) ([]*models.Component, error) {
	var components []*models.Component

	// Добавляем в срез components компоненты полученные по каждому типу
	for _, ctype := range types {
		componentsByType, err := s.componentModel.SelectByType(ctype)
		if err != nil {
			return nil, err
		}

		components = append(components, componentsByType...)
	}

	return components, nil
}

// Возвращает все компоненты с указанными ID
func (s *ComponentService) ReadByIDs(ids []int) ([]*models.Component, error) {
	var components []*models.Component

	for _, id := range ids {
		component, err := s.componentModel.SelectByID(id)
		if err != nil {
			return nil, err
		}

		components = append(components, component)
	}

	return components, nil
}

// Добавляет новый компонент в БД
func (s *ComponentService) Create(name string, weight float64, componentType string, note string) error {
	return s.componentModel.Insert(name, weight, componentType, note)
}

// Обновляет компонент с указанным ID
func (s *ComponentService) Update(id int, name string, weight float64, componentType string, note string) error {
	return s.componentModel.Update(id, name, weight, componentType, note)
}

// Удаляет компонент с указанным ID
func (s *ComponentService) Delete(id int) error {
	return s.componentModel.Delete(id)
}
