package services

import (
	"errors"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type RouteService struct {
	RouteModel   *mysql.RouteModel
	StorageModel *mysql.StorageModel
}

func NewRouteService(routeModel *mysql.RouteModel, storageModel *mysql.StorageModel) *RouteService {
	return &RouteService{
		RouteModel:   routeModel,
		StorageModel: storageModel,
	}
}

func (s *RouteService) ReadAll() ([]*models.Route, error) {
	routes, err := s.RouteModel.SelectAll()
	if err != nil {
		return nil, err
	}

	return selectStoragesForRoutes(routes, s.StorageModel)
}

func (s *RouteService) ReadByIDs(ids []int) ([]*models.Route, error) {
	var routes []*models.Route

	for _, id := range ids {
		route, err := s.RouteModel.SelectByID(id)
		if err != nil {
			return nil, err
		}

		routes = append(routes, route)
	}

	return selectStoragesForRoutes(routes, s.StorageModel)
}

func (s *RouteService) ReadByFromIDs(ids []int) ([]*models.Route, error) {
	var routes []*models.Route

	for _, id := range ids {
		route, err := s.RouteModel.SelectByFromID(id)
		if err != nil {
			return nil, err
		}

		routes = append(routes, route...)
	}

	return selectStoragesForRoutes(routes, s.StorageModel)
}

func (s *RouteService) ReadByToIDs(ids []int) ([]*models.Route, error) {
	var routes []*models.Route

	for _, id := range ids {
		route, err := s.RouteModel.SelectByToID(id)
		if err != nil {
			return nil, err
		}

		routes = append(routes, route...)
	}

	return selectStoragesForRoutes(routes, s.StorageModel)
}

func (s *RouteService) ReadByTransitIDs(ids []int) ([]*models.Route, error) {
	var routes []*models.Route

	for _, id := range ids {
		route, err := s.RouteModel.SelectByTransitID(id)
		if err != nil {
			return nil, err
		}

		routes = append(routes, route...)
	}

	return selectStoragesForRoutes(routes, s.StorageModel)
}

func (s *RouteService) Create(fromID, toID, transitID, edh int) error {
	if fromID == toID {
		return errors.New("routes service: fromID equals toID")
	} else if edh <= 0 {
		return errors.New("routes service: edh <= 0")
	}

	return s.RouteModel.Insert(fromID, toID, transitID, edh)
}

func (s *RouteService) Delete(id int) error {
	return s.RouteModel.Delete(id)
}

func selectStoragesForRoutes(routes []*models.Route, s *mysql.StorageModel) ([]*models.Route, error) {
	for _, route := range routes {
		storagePtr, err := s.SelectWithoutInventoryByID(route.From.ID)
		if err != nil {
			return nil, err
		}
		route.From = *storagePtr

		storagePtr, err = s.SelectWithoutInventoryByID(route.To.ID)
		if err != nil {
			return nil, err
		}
		route.To = *storagePtr

		storagePtr, err = s.SelectWithoutInventoryByID(route.Transit.ID)
		if err != nil {
			return nil, err
		}
		route.Transit = *storagePtr
	}

	return routes, nil
}
