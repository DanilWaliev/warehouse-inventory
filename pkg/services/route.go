package services

import "warehouse-inventory/pkg/models/mysql"

type RouteService struct {
	RouteModel *mysql.RouteModel
}

func NewRouteService(routeModel *mysql.RouteModel) *RouteService {
	return &RouteService{
		RouteModel: routeModel,
	}
}
