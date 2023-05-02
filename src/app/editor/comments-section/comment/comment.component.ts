import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { DateSelectionModelChange } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';

import { uuidv4 } from 'lib0/random';
import { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { Mark } from 'prosemirror-model';

import { ProsemirrorEditorsService } from '../../services/prosemirror-editors.service';
import { YMap } from 'yjs/dist/src/internals';
import { YdocService } from '../../services/ydoc.service';
import { AuthService } from "@core/services/auth.service";
import { ServiceShare } from '@app/editor/services/service-share.service';
import { AddCommentDialogComponent } from '../../add-comment-dialog/add-comment-dialog.component';
import { fakeUser } from '@app/core/services/comments/comments-interceptor.service';
import { ContributorsApiService } from '@app/core/services/comments/contributors-api.service';
import { EditCommentDialogComponent } from '../edit-comment-dialog/edit-comment-dialog.component';
import { AskBeforeDeleteComponent } from '@app/editor/dialogs/ask-before-delete/ask-before-delete.component';
import { commentData, commentYdocSave, ydocComment } from '../../utils/commentsService/commentMarksHelpers';


export function getDate(date: number) {
  let timeOffset = (new Date()).getTimezoneOffset() * 60 * 1000;
  let d = new Date(+date/*+timeOffset  * 1000 */)
  //d.setTime(d.getTime()/*+ (2*60*60*1000) */);
  let timeString = d.getHours() + ":" + (`${d.getMinutes()}`.length == 1 ? `0${d.getMinutes()}` : d.getMinutes()) + " " + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d.getDay() - 1] + " " + d.getDate() + "/" + d.getMonth() + "/" + d.getFullYear();
  return timeString
}

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss']
})
export class CommentComponent implements OnInit, AfterViewInit, OnDestroy {
  private unsubscribe$ = new Subject<void>();
  @Input() comment?: commentData;

  @Input() doneRenderingCommentsSubject?: Subject<any>;
  @Output() doneRenderingCommentsSubjectChange = new EventEmitter<Subject<any>>();

  @ViewChild('content') elementView: ElementRef | undefined;
  @ViewChild('ReplyDiv') ReplyDiv: ElementRef | undefined;

  @Output() selected = new EventEmitter<boolean>();

  replyInputDisplay = false
  initialShowMore = false;
  repliesShowMore: boolean[] = [];
  moreLessBtnView: any = {};
  MAX_CONTENT_WIDTH = 290;
  contentWidth: number = this.MAX_CONTENT_WIDTH;
  commentsMap?: YMap<any>
  userComment?: commentYdocSave;
  mobileVersion: boolean
  filteredUsers:fakeUser[]

  replyFormControl = new FormControl('');
  showAutoComplete =  false;
  activeReply = false;


  constructor(
    public authService: AuthService,
    public ydocService: YdocService,
    public sharedDialog: MatDialog,
    private prosemirrorEditorService: ProsemirrorEditorsService,
    private contributorsApiService:ContributorsApiService,
    private sharedService: ServiceShare,
    private router:Router,
    public dialog:MatDialog,
  ) {

    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    this.router.onSameUrlNavigation = 'reload';
    if (this.ydocService.editorIsBuild) {
      this.commentsMap = this.ydocService.getCommentsMap()
    }
    this.ydocService.ydocStateObservable.pipe(takeUntil(this.unsubscribe$)).subscribe((event) => {
      if (event == 'docIsBuild') {
        this.commentsMap = this.ydocService.getCommentsMap()

      }
    });
    this.mobileVersion = prosemirrorEditorService.mobileVersion
  }

  currUserId

  ngOnInit(): void {
    this.userComment = this.commentsMap?.get(this.comment!.commentAttrs.id) || { initialComment: undefined, commentReplies: undefined };
    this.authService.currentUser$.pipe(takeUntil(this.unsubscribe$)).subscribe((userInfo)=>{
      //@ts-ignore
      this.currUserId = userInfo.id
    })
    this.prosemirrorEditorService.mobileVersionSubject.pipe(takeUntil(this.unsubscribe$)).subscribe((data) => {
      // data == true => mobule version
      this.mobileVersion = data
    })


  }

  commentIsChangedInYdoc() {
    this.doneRenderingCommentsSubject.next('change_in_comments_in_ydoc');
  }

  showMoreLessClick(){
    setTimeout(()=>{
      this.doneRenderingCommentsSubject.next('show_more_less_click');
    },30)
  }

  checkIfCommentHasChanged(commentInYdoc: commentYdocSave) {
    let changed = false;
    if (commentInYdoc) {
      if (commentInYdoc.initialComment.comment != this.userComment.initialComment.comment) {
        changed = true;
      }
      if (commentInYdoc.commentReplies.length != this.userComment.commentReplies.length) {
        changed = true;
      } else {
        commentInYdoc.commentReplies.forEach((reply, index) => {
          let localReply = this.userComment.commentReplies[index];
          if (localReply.comment != reply.comment) {
            changed = true;
          }
        })
      }
    } else {
      // comment deleted
      changed = true;
    }
    if (changed && commentInYdoc) {
      this.userComment = JSON.parse(JSON.stringify(commentInYdoc))

      setTimeout(() => {
        this.commentIsChangedInYdoc()
      }, 20)
    }
  }


  ngAfterViewInit() {
    setTimeout(() => {
      this.doneRenderingCommentsSubject.next('rendered')
    }, 10)
    this.sharedService.CommentsService.ydocCommentsChangeSubject.pipe(takeUntil(this.unsubscribe$)).subscribe((commentsObj) => {
      let ydocCommentInstance = commentsObj[this.comment.commentAttrs.id]
      this.checkIfCommentHasChanged(ydocCommentInstance)
    })
    this.userComment?.commentReplies.forEach((comment, index) => {
      this.repliesShowMore[index] = false
    })
    this.sharedService.CommentsService.lastSelectedCommentSubject.pipe(takeUntil(this.unsubscribe$)).subscribe((comment) => {
      if(this.ydocService.curUserAccess&&this.ydocService.curUserAccess=='View only'){
        return
      }
      if (this.comment.commentAttrs.id == comment.commentId) {
        (this.ReplyDiv.nativeElement as HTMLDivElement).style.display = 'block'
        this.selected.emit(true);
      } else {
        (this.ReplyDiv.nativeElement as HTMLDivElement).style.display = 'none'
        this.selected.emit(false);
      }
    })

  }

  selectComment() {
    let view = this.sharedService.ProsemirrorEditorsService.editorContainers[this.comment.section].editorView;
    let actualComment: commentData
    let allComments = this.sharedService.CommentsService.commentsObj
    Object.keys(allComments).forEach((commentid) => {
      let com = allComments[commentid]
      if (com && com.commentAttrs.id == this.comment.commentAttrs.id) {
        actualComment = com
      }
    })
    if (actualComment) {

      view.focus()
      view.dispatch(view.state.tr.setSelection(new TextSelection(view.state.doc.resolve(actualComment.pmDocStartPos), view.state.doc.resolve(actualComment.pmDocStartPos))).setMeta('selected-comment',true).scrollIntoView())

      this.sharedService.ProsemirrorEditorsService.dispatchEmptyTransaction()
      //this.showHideReply(this.ReplyDiv.nativeElement as HTMLDivElement, true)
      //this.sharedService.CommentsService.lastSelectedCommentSubject.next({ commentId:actualComment.commentAttrs.id, pos:actualComment.pmDocStartPos, sectionId:actualComment.section, commentMarkId:actualComment.commentAttrs.commentmarkid })
    }
  }

  onDelete(view: EditorView, commentId: string) {
    let state = view.state;
    let commentsMark = state?.schema.marks.comment;
    let overlapCommentsMark = state?.schema.marks.overlapComment;
    let docSize = state.doc.content.size;
    let from: number, to: number;
    let markForRemove: Mark;

    state.doc.nodesBetween(0, docSize, (node, pos, parent) => {
      let comment = node?.marks.find(c => c.attrs.id == commentId);

      if(comment && comment.type == commentsMark){
        markForRemove = comment;
        if(!from) {
          from = pos;
        }
        to = pos += node.nodeSize;
      } else if (comment && comment.type == overlapCommentsMark) {
        markForRemove = comment;
        if(!from) {
          from = pos;
        }
        to = pos += node.nodeSize;
      }
    })
    view.dispatch(state.tr.removeMark(from, to, markForRemove));

    this.commentsMap?.delete(this.comment?.commentAttrs.id);
  }

  deleteComment(showConfirmDialog, comment) {
    let viewRef = this.sharedService.ProsemirrorEditorsService.editorContainers[this.comment.section].editorView
    if (showConfirmDialog) {
      let dialogRef = this.dialog.open(AskBeforeDeleteComponent, {
        data: { objName: comment, type: 'comment' },
        panelClass: 'ask-before-delete-dialog',
      })
      dialogRef.afterClosed().subscribe((data: any) => {
        if (data) {
          this.onDelete(viewRef, this.comment.commentAttrs.id);
        }
      })
      return;
    }
    this.onDelete(viewRef, this.comment.commentAttrs.id)
  }

  deleteReply(id: string, reply: string) {
    let dialogRef = this.dialog.open(AskBeforeDeleteComponent, {
      data: { objName: reply, type: 'reply' },
      panelClass: 'ask-before-delete-dialog',
    })
    dialogRef.afterClosed().subscribe((data: any) => {
      if (data) {
        let commentData: commentYdocSave = this.commentsMap?.get(this.comment?.commentAttrs.id);
        commentData.commentReplies.splice(commentData.commentReplies.findIndex((el) => { return el.id == id }), 1);
        this.commentsMap?.set(this.comment?.commentAttrs.id, commentData);
        this.userComment = commentData;
      }
    })

  }

  showReplyFocusHandle(replyDiv: HTMLDivElement, autocomplete) {
    this.activeReply = true;
    autocomplete.showResults();
  }

  hideReplyBlurHandle(replyDiv: HTMLDivElement) {
    if (this.replyFormControl.value == '') {
      this.activeReply = false;
    }
  }

  clickOutsideHandler(event, autocomplete) {
    if(event.target.tagName !== "INPUT" && event.target.tagName !== "MAT-ICON"){
      autocomplete.hideResults();
    }
  }

  cancelReplyBtnHandle(replyDiv: HTMLDivElement) {
    this.replyFormControl.setValue('');
    this.activeReply = false;
  }

  editComment(id: string, comment: string) {
    let commentData: commentYdocSave = this.commentsMap?.get(this.comment?.commentAttrs.id);
    let commentContent: any = comment;
    const dialogRef = this.sharedDialog.open(EditCommentDialogComponent, {
      panelClass:'comment-edit-dialog',
      width: '582px',
      data: {
        comment: commentContent,
        type: 'comment',
        actualCommentId:this.comment
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      let newcommentContent = result;
      if (result && newcommentContent!=commentContent) {
        commentData.initialComment.comment = newcommentContent;
        this.userComment = commentData;
        this.commentsMap?.set(this.comment?.commentAttrs.id, commentData);
        this.contentWidth = this.elementView?.nativeElement.firstChild.offsetWidth;
        this.moreLessBtnView[this.comment!.commentAttrs.id] = this.contentWidth >= this.MAX_CONTENT_WIDTH
      }
    });
  }

  editReply(id: string, comment: string) {
    let commentData: commentYdocSave = this.commentsMap?.get(this.comment?.commentAttrs.id);
    let commentContent: any = comment;
    const dialogRef = this.sharedDialog.open(EditCommentDialogComponent, {
      panelClass:'comment-edit-dialog',
      width: '582px',
      data: { comment:
        commentContent,
        type: 'comment',
        actualCommentId:this.comment,
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      let newcommentContent = result;
      if (result && newcommentContent!=commentContent) {
        commentData.commentReplies.forEach((userComment, index, array) => {
          if (userComment.id == id) {
            array[index].comment = newcommentContent;
          }
        })
        this.userComment = commentData;
        this.commentsMap?.set(this.comment?.commentAttrs.id, commentData);
        this.contentWidth = this.elementView?.nativeElement.firstChild.offsetWidth;
        this.moreLessBtnView[this.comment!.commentAttrs.id] = this.contentWidth >= this.MAX_CONTENT_WIDTH

      }
    });
  }

  getDate = getDate

  commentReplyBtnHandle = ( replyDiv: HTMLDivElement)=> {
    if (!this.replyFormControl.value) {
      return
    }
    let commentData: commentYdocSave = this.commentsMap?.get(this.comment?.commentAttrs.id);
    let commentContent;
    let userCommentId = uuidv4();
    let commentDate = Date.now()

    commentContent = this.replyFormControl.value

    let userComment = {
      id: userCommentId,
      comment: commentContent,
      userData:  {
        ...this.prosemirrorEditorService.userInfo.data,
        userColor:this.prosemirrorEditorService.userInfo.color.userColor,
        userContrastColor:this.prosemirrorEditorService.userInfo.color.userContrastColor
      },
      date: commentDate
    }
    commentData.commentReplies.push(userComment);
    this.commentsMap?.set(this.comment?.commentAttrs.id, commentData);
    this.userComment = commentData;
    this.replyFormControl.setValue('');
    this.activeReply = false;
    setTimeout(()=>{
      this.doneRenderingCommentsSubject.next('replay_rerender')
    },400)
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
