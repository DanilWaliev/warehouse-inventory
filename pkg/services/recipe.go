package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type RecipeService struct {
	recipeModel *mysql.RecipeModel
}

func (s *RecipeService) ReadAll() ([]*models.Recipe, error) {
	return s.recipeModel.SelectAll()
}

func (s *RecipeService) ReadByIDs(ids []int) ([]*models.Recipe, error) {
	var recipes []*models.Recipe

	for _, id := range ids {
		recipe, err := s.recipeModel.SelectByID(id)
		if err != nil {
			return nil, err
		}

		recipes = append(recipes, recipe)
	}

	return recipes, nil
}

func (s *RecipeService) Create(recipe *models.Recipe) error {
	return s.recipeModel.Insert(recipe)
}

func (s *RecipeService) Delete(id int) error {
	return s.recipeModel.Delete(id)
}

func (s *RecipeService) Update(r *models.Recipe) error {
	return s.recipeModel.Update(r)
}
