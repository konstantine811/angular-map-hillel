import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import Map from '@arcgis/core/Map';
// rxjs
import { take } from 'rxjs/operators';
// esri
import SceneView from '@arcgis/core/views/SceneView';
import MapView from '@arcgis/core/views/SceneView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import Sketch from '@arcgis/core/widgets/Sketch';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import ActionButton from '@arcgis/core/support/actions/ActionButton';
import * as geometry from '@arcgis/core/geometry';
import * as coordFormatter from '@arcgis/core/geometry/coordinateFormatter';
// material
import { MatDialog } from '@angular/material/dialog';
// components
import { CreateFieldDialogComponent } from './components/create-field-dialog/create-field-dialog.component';
// models
import { IFeildFormData, IFieldArcgisAttr } from './models/field.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {
  map!: Map;
  view!: SceneView;
  sketchGraphicLayer!: GraphicsLayer;
  sketch!: Sketch;
  featureLayer!: FeatureLayer;

  constructor(public dialog: MatDialog) {}

  initMap() {
    const graphicLayer = new GraphicsLayer();

    this.featureLayer = new FeatureLayer({
      url: 'https://services6.arcgis.com/AdMQ9oCp30CfMWVW/arcgis/rest/services/test_polygon_layer/FeatureServer/0',
    });

    this.map = new Map({
      basemap: 'hybrid',
      layers: [graphicLayer, this.featureLayer],
    });

    this.view = new SceneView({
      container: 'map',
      map: this.map,
      popup: {
        defaultPopupTemplateEnabled: true,
      },
    });

    const markerSymbol = {
      type: 'simple-marker',
      color: [225, 119, 40],
      outline: {
        color: [255, 255, 255],
        width: 2,
      },
    };

    this.view.map.add(graphicLayer);
    this.view.on('pointer-move', ['Shift'], (e) => {
      const point = this.view.toMap(e);
      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
      });
      graphicLayer.add(pointGraphic);
    });
    this.workFeature();
    this.createSketchWidget();
  }

  workFeature() {
    this.featureLayer.queryFeatures().then((res) => {
      if (res.features.length) {
        this.view.goTo(res.features[0].geometry.extent, {
          duration: 15000,
          easing: 'in-out-expo',
        });
      }
    });

    this.featureLayer.when(() => {
      this.featureLayer.sourceJSON.drawingInfo.renderer =
        new UniqueValueRenderer({
          field: 'CropName',
          defaultSymbol: new SimpleFillSymbol({
            color: [0, 0, 0, 0.3],
          }), // autocasts as new SimpleFillSymbol()
          uniqueValueInfos: [
            {
              // All features with value of "North" will be blue
              value: 'Зерно',
              symbol: new SimpleFillSymbol({
                color: [255, 255, 255, 0.5],
              }),
            },
          ],
        });
    });
    this.addCustromPopupAction();
  }

  addCustromPopupAction() {
    // Defines an action to zoom out from the selected feature
    let editAaction = new ActionButton({
      // This text is displayed as a tooltip
      title: 'Редактировать полигон',
      // The ID by which to reference the action in the event handler
      id: 'edit-polygon',
      // Sets the icon font used to style the action button
      className: 'esri-icon-edit',
    });
    // Adds the custom action to the popup.
    this.view.popup.actions.push(editAaction);
    this.view.popup.on('trigger-action', async (e) => {
      console.log(e.action);
      const { OBJECTID } = this.view.popup.selectedFeature
        .attributes as IFieldArcgisAttr;
      const query = this.featureLayer.createQuery();
      query.returnGeometry = true;
      query.where = `OBJECTID = ${OBJECTID}`;
      const { features } = await this.featureLayer.queryFeatures(query);
      console.log(features);
      const feature = features[0];
      this.sketchGraphicLayer.add(feature);
      this.sketch.update(feature);
      this.view.popup.close();
      this.featureLayer.applyEdits({
        deleteFeatures: [this.view.popup.selectedFeature],
      });
    });
  }

  createSketchWidget() {
    this.sketchGraphicLayer = new GraphicsLayer({
      elevationInfo: {
        mode: 'on-the-ground',
      },
      title: 'Sketch GraphicsLayer',
    });

    this.map.add(this.sketchGraphicLayer);

    this.view.when(() => {
      this.sketch = new Sketch({
        layer: this.sketchGraphicLayer,
        view: this.view,
        creationMode: 'update',
        defaultCreateOptions: {
          hasZ: false,
        },
        defaultUpdateOptions: {
          enableZ: false,
        },
      });

      this.view.ui.add(this.sketch, 'top-right');

      this.listenSketch();
    });
  }

  listenSketch() {
    this.sketch.on('create', (e) => {
      if (e.state === 'complete') {
        console.log(e.graphic);
      }
    });
    this.sketch.on('update', (e) => {
      console.log();
      if (e.state === 'complete') {
        this.openDialog(e.graphics[0]);
      }
    });
  }

  openDialog(graphicData: Graphic) {
    const dialogRef = this.dialog.open(CreateFieldDialogComponent, {
      width: '340px',
      disableClose: true,
      data: graphicData.attributes,
    });
    dialogRef
      .afterClosed()
      .pipe(take(1))
      .subscribe((res: IFeildFormData) => {
        console.log(res);
        if (res && res.fieldNumber && res.cropName && res.year) {
          graphicData.attributes = res;
          console.log(graphicData);
          this.featureLayer
            .applyEdits({
              addFeatures: [graphicData],
            })
            .then((results) => {
              console.log(results);
            });
          this.sketchGraphicLayer.remove(graphicData);
        }
      });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }
}
