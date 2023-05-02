import { ThisReceiver } from '@angular/compiler';
import { AfterViewChecked, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { uuidv4 } from "lib0/random";

@Component({
  selector: 'app-choose-manuscript-dialog',
  templateUrl: './choose-manuscript-dialog.component.html',
  styleUrls: ['./choose-manuscript-dialog.component.scss'],
  changeDetection:ChangeDetectionStrategy.OnPush
})
export class ChooseManuscriptDialogComponent implements OnInit, AfterViewInit, AfterViewChecked {

  showError = false;
  articleTemplates: any[] = [];
  value?: string;
  constructor(
    public dialog: MatDialog,
    private dialogRef: MatDialogRef<ChooseManuscriptDialogComponent>,
    private ref:ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: { layouts: any },
  ) {

  }

  ngAfterViewChecked(): void {
    this.ref.detectChanges()
  }

  ngOnInit(): void {

  }

  ngAfterViewInit(): void {
    this.articleTemplates = JSON.parse(JSON.stringify(this.data.layouts.data));

  }

  createManuscript(val: any) {
    if (!val) {
      this.showError = true
      setTimeout(() => {
        this.showError = false
      }, 1000)
    } else {
      this.dialogRef.close(val)
    }
  }

  closeManuscriptChoose() {
    this.dialogRef.close()
  }

  timer:any
  search(input: HTMLInputElement) {
    if(this.timer){
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.value = input.value?.toLocaleLowerCase();

      this.articleTemplates = JSON.parse(JSON.stringify(this.data.layouts.data));
      if (this.value && this.value !== '') {
        const newArr = [];
        this.articleTemplates.forEach((article => {
          if(article.name.toLocaleLowerCase().includes(this.value)) {
            newArr.push(article);
          }
        }));
        this.articleTemplates = newArr;
      }
      this.timer = undefined
    }, 300)
  }
}
