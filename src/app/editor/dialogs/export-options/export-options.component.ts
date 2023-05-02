import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { AppConfig, APP_CONFIG } from '@app/core/services/app-config';
import { ServiceShare } from '@app/editor/services/service-share.service';

import { getYdocData } from '../edit-before-export/getYdocData';
import { ExportJsonLdComponent } from '../export-json-ld/export-json-ld.component';
import { exportAsJatsXML } from './jatsXML/exportAsJatsXML';
import { EditBeforeExportComponent } from '../edit-before-export/edit-before-export.component';
import { schema } from '@app/editor/utils/Schema';
import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';
import { pdfSettingsSave } from './pdfSettings';

@Component({
  selector: 'app-export-options',
  templateUrl: './export-options.component.html',
  styleUrls: ['./export-options.component.scss']
})
export class ExportOptionsComponent {

  selectedType: 'pdf' | 'rtf' | 'msWord' | 'jatsXml' | 'json-ld' = 'pdf';
  path = 'C:/users/User1/Descktop'
  constructor(
    private dialog:MatDialog,
    private sharedService:ServiceShare, 
    private httpClient: HttpClient,
    @Inject(APP_CONFIG) private config: AppConfig
    ) { }

  openEditBeforeExport(selected:any){
    if(selected == 'pdf'){
      if(this.config.production) {
        this.exportAsPdf().subscribe((data)=>{
          console.log('pdf',data);
        }) 
      } else {
        this.dialog.open(EditBeforeExportComponent, {
          maxWidth: '100vw',
          maxHeight: '100vh',
          height: '97%',
          width: '97%',
          panelClass:'pdf-edit-and-preview',
          data:{selected}
        });
      }
    }else if(selected == 'json-ld'){
      let dialogRef = this.dialog.open(ExportJsonLdComponent, {
        maxWidth: '100vw',
        maxHeight: '100vh',
        height: '97%',
        width: '97%',
        panelClass:'pdf-edit-and-preview',
        data:{selected}
      });
    }else if(selected == 'jatsXml'){
      exportAsJatsXML(this.sharedService);
    }

  }

  exportAsPdf() {
    const articleId = this.sharedService.YdocService.articleData.uuid;

    const headerContainer = document.createElement('div');
    const footerContainer = document.createElement('div');

    const header = new EditorView(headerContainer,{
      state: EditorState.create({
        doc: schema.nodes.doc.create({}, schema.nodes.form_field.create({}, schema.nodes.paragraph.create({}, schema.text('Header should be displayed here.')))),
      }),
    })
    const footer = new EditorView(footerContainer,{
      state: EditorState.create({
        doc: schema.nodes.doc.create({}, schema.nodes.form_field.create({}, schema.nodes.paragraph.create({}, schema.text('Footer should be displayed here.')))),
      }),
    })

    const headerPmNodesJson = header.state.doc.toJSON();
    const footerPmNodesJson = footer.state.doc.toJSON();

    const articleData = getYdocData(this.sharedService.YdocService.ydoc);

    articleData.pdfSettings = this.fillSettings();
    articleData.headerPmNodesJson = headerPmNodesJson;
    articleData.footerPmNodesJson = footerPmNodesJson;

    return this.httpClient.post(`${this.config.apiUrl}/articles/items/`+ articleId +'/pdf/export',articleData)

    // return this.httpClient.post('http://127.0.0.1:3003/article/pdf', articleData);
  }

  fillSettings() {
    let buildNodeSettings = (settingsFromUser: any) => {
      let nodeSettings: any;
      nodeSettings = JSON.parse(JSON.stringify(settingsFromUser.nodes));
      return nodeSettings;
    }
    let buildPdfSettings = (settingsFromUser: any) => {
      let pdfSettings: any = {};
      pdfSettings.maxFiguresImagesDownscale = settingsFromUser.maxFiguresImagesDownscale;
      pdfSettings.maxMathDownscale = settingsFromUser.maxMathDownscale;
      pdfSettings.minParagraphLinesAtEndOfPage = settingsFromUser.minParagraphLinesAtEndOfPage;
      pdfSettings.header = settingsFromUser.header;
      pdfSettings.footer = settingsFromUser.footer;
      pdfSettings.pageMargins = settingsFromUser.pageMargins;
      pdfSettings.nodes = settingsFromUser.nodes;
      Object.keys(settingsFromUser.pageFormat).forEach((format) => {
        if (settingsFromUser.pageFormat[format]) {
          pdfSettings.pageFormat = format;
        }
      })
      return pdfSettings;
    }
    let buildSettings = (settingsFromUser: any) => {
      let settings: any = {};
      let nodesSettings = buildNodeSettings(settingsFromUser);
      let pdfSettings = buildPdfSettings(settingsFromUser);
      settings.nodes = nodesSettings;
      settings.pdf = pdfSettings;
      return settings
    }
    let data = JSON.parse(JSON.stringify(pdfSettingsSave));

    return buildSettings(data);
  }
}
