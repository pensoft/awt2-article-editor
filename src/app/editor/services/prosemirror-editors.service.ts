import { Injectable } from '@angular/core';
//@ts-ignore
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket'
import { ColorDef } from 'y-prosemirror/dist/src/plugins/sync-plugin';
import * as random from 'lib0/random.js';
import * as userSpec from '../utils/userSpec';
//@ts-ignore
import { sherePreviewModeState } from '../utils/prosemirror-menu-master/src/menu.js';
//@ts-ignore
import { buildMenuItems, exampleSetup } from '../utils/prosemirror-example-setup-master/src/index.js';
import { /* endEditorSchema, */schema,nodes as nodesDefinitions,marks as marksDefinitions, PMDOMSerializer } from '../utils/Schema';
import {
  insertMathCmd,
  makeInlineMathInputRule,
  mathBackspaceCmd,
  mathPlugin,
  mathSerializer,
  MathView,
  REGEX_BLOCK_MATH_DOLLARS,
  REGEX_INLINE_MATH_DOLLARS
} from '@benrbray/prosemirror-math';
import { DOMSerializer, Node, NodeType, Schema, Slice } from 'prosemirror-model';
//@ts-ignore
import { EditorView } from 'prosemirror-view';
import { EditorState, Plugin, PluginKey, Transaction, TextSelection, Selection, NodeSelection } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { chainCommands, deleteSelection, joinBackward, selectNodeBackward } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
//@ts-ignore
import { yCursorPlugin,  ySyncPlugin, ySyncPluginKey, ySyncPluginKeyObj } from '../../y-prosemirror-src/y-prosemirror.js';
import { CellSelection, columnResizing, goToNextCell, tableEditing } from '../../../../prosemirror-tables/src/index';
//@ts-ignore
import * as trackedTransaction from '../utils/trackChanges/track-changes/index.js';
import { CommentsService } from '../utils/commentsService/comments.service';
import { InputRule, inputRules } from 'prosemirror-inputrules';
import { YdocService } from './ydoc.service';
import { TrackChangesService } from '../utils/trachChangesService/track-changes.service';
import { PlaceholderPluginService } from '../utils/placeholderPlugin/placeholder-plugin.service';
import { DetectFocusService } from '../utils/detectFocusPlugin/detect-focus.service';
import { MenuService } from './menu.service';
import { Observable, Subject } from 'rxjs';
import { LinkPopUpPluginServiceService } from '../utils/linkPopUpPlugin/link-pop-up-plugin-service.service';
import {
  articleSection,
  editorData,
  sectionContent,
  taxonomicCoverageContentData,
  titleContent
} from '../utils/interfaces/articleSection';
//@ts-ignore
import { TreeService } from '../meta-data-tree/tree-service/tree.service';
//@ts-ignore
import { menuBar } from '../utils/prosemirror-menu-master/src/menubar.js'
import { FormioControl } from 'src/app/formio-angular-material/FormioControl';
import { AddMarkStep, Mapping, RemoveMarkStep, ReplaceAroundStep, ReplaceStep } from 'prosemirror-transform';
import { handleClick, handleDoubleClick as handleDoubleClickFN, handleKeyDown, handlePaste, createSelectionBetween, handleTripleClickOn, preventDragDropCutOnNoneditablenodes, updateControlsAndFigures, handleClickOn, selectWholeCitatMarksAndRefCitatNode, handleScrollToSelection, transformPastedHTML } from '../utils/prosemirrorHelpers';
//@ts-ignore
import { figure } from '../utils/interfaces/figureComponent';
import { CitatContextMenuService } from '../utils/citat-context-menu/citat-context-menu.service';
import { ServiceShare } from './service-share.service';
import { YjsHistoryService } from '../utils/yjs-history.service';
import { uuidv4 } from 'lib0/random.js';
import { changeNodesOnDragDrop, handleDeleteOfRefsFigsCitationsAndComments } from '../utils/prosemirrorHelpers/drag-drop-append';
import { getFilterNodesBySchemaDefPlugin } from '../utils/Schema/filterNodesIfSchemaDefPlugin';
import { CitableElementsEditButtonsService } from '../utils/citable-elements-edit-buttons/citable-elements-edit-buttons.service';
import { getToolTipPlugin } from '../utils/toolTipPlugin';
import {getItems} from '../utils/menu/menuItems'
import { LinkButtonsService } from '../utils/link-buttons/link-buttons.service';
import { CitationButtonsService } from '../utils/citation-buttons/citation-buttons.service';
export interface editorContainersObj { [key: string]: editorContainer }
export interface editorContainer {
  editorID: string,
  containerDiv: HTMLDivElement,
  editorState: EditorState,
  editorView: EditorView,
  dispatchTransaction: any
}
let requestFiveFrames = function (num: number) {
  return () => {
    if (num < 5) {
      window.requestAnimationFrame(requestFiveFrames(num++))
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class ProsemirrorEditorsService {

  ydoc?: Y.Doc;
  //provider?: WebrtcProvider;
  provider?: WebsocketProvider;
  preventAddToHistory = false;
  previewArticleMode = { mode: false }

  articleSectionsStructure?: articleSection[];
  initDocumentReplace: any = {};
  editorContainers: editorContainersObj = {}
  xmlFragments: { [key: string]: Y.XmlFragment } = {}

  usersInArticleStatusSubject = new Subject<Map<any, any>>()

  interpolateTemplate: any
  userInfo: any;

  FullSchemaDOMPMSerializer = DOMSerializer.fromSchema(schema);

  color = random.oneOf(userSpec.colors);
  user = random.oneOf(userSpec.testUsers);
  colorMapping: Map<string, ColorDef> = new Map([[this.user.username, this.color],]);
  permanentUserData?: Y.PermanentUserData;
  colors = userSpec.colors;
  menu: any = buildMenuItems(schema);
  menuTypes: any = {}

  makeBlockMathInputRule(pattern: RegExp, nodeType: NodeType, getAttrs?: (match: string[]) => any) {
    return new InputRule(pattern, (state, match, start, end) => {
      let $start = state.doc.resolve(start)
      let attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs
      let tr = state.tr.replaceWith(start, end, nodeType.create(attrs))
      return tr.setSelection(NodeSelection.create(
        tr.doc, start + 1
      ))
    })
  }

  globalMenusAndSchemasSectionsDefs = {}
  OnOffTrackingChangesShowTrackingSubject = new Subject<{ trackTransactions: boolean }>()
  trackChangesMeta: any
  shouldTrackChanges = false
  treeChangesCount = 0
  transactionCount = 0;

  editorsEditableObj: { [key: string]: boolean } = {}

  mobileVersionSubject = new Subject<boolean>()
  mobileVersion = false;

  defaultValuesObj: any = {}
  editorsDeleteArray: string[] = []
  userData: any

  deletedCitatsInPopUp: { [key: string]: string[] } = {}
  rerenderFigures: any
  setFigureRerenderFunc = (fn: any) => {
    this.rerenderFigures = fn;
  }
  rerenderTables:any
  setTablesRerenderFunc = (fn: any) => {
    this.rerenderTables = fn
  }
  ySyncKey = ySyncPluginKey
  ySyncPluginKeyObj = ySyncPluginKeyObj
  constructor(
    private menuService: MenuService,
    private detectFocusService: DetectFocusService,
    private placeholderPluginService: PlaceholderPluginService,
    private ydocService: YdocService,
    private linkPopUpPluginService: LinkPopUpPluginServiceService,
    private commentsService: CommentsService,
    private treeService: TreeService,
    private citatContextPluginService: CitatContextMenuService,
    private trackChangesService: TrackChangesService,
    private yjsHistory: YjsHistoryService,
    private citableElementEditButtonsPluginService:CitableElementsEditButtonsService,
    private linkButtonsPluginService: LinkButtonsService,
    private citationButtonsService: CitationButtonsService,
    private serviceShare: ServiceShare) {

    // change the mathBlock input rule
    sherePreviewModeState(this.previewArticleMode)

    this.serviceShare.shareSelf('ProsemirrorEditorsService', this)
    this.mobileVersionSubject.subscribe((data) => {
      // data == true => mobule version
      this.mobileVersion = data

    })
    this.OnOffTrackingChangesShowTrackingSubject.subscribe((data) => {
      this.shouldTrackChanges = data.trackTransactions
      let trackCHangesMetadata = this.ydocService.trackChangesMetadata?.get('trackChangesMetadata');
      trackCHangesMetadata.lastUpdateFromUser = this.ydoc?.guid;
      trackCHangesMetadata.trackTransactions = data.trackTransactions
      this.ydocService.trackChangesMetadata?.set('trackChangesMetadata', trackCHangesMetadata);
    })

  }

  getScrollPosition() {
    let articleProsemirrorsContainer = document.getElementsByClassName('editor-container')[0];
    return articleProsemirrorsContainer!.scrollTop!;
  }

  applyLastScrollPosition(scrollPos:number) {
    let articleProsemirrorsContainer = document.getElementsByClassName('editor-container')[0];
    articleProsemirrorsContainer!.scrollTop = scrollPos;
  }

  collab(config: any = {}) {
    config = {
      version: config.version || 0,
      clientID: config.clientID == null ? Math.floor(Math.random() * 0xFFFFFFFF) : config.clientID
    }
  }

  getXmlFragment(mode: string = 'documentMode', id: string) {
    if (this.xmlFragments[id]) {
      return this.xmlFragments[id]
    }
    let xmlFragment = this.ydocService.ydoc?.getXmlFragment(id)
    this.xmlFragments[id] = xmlFragment;
    return xmlFragment
  }

  deleteXmlFragment(id: string) {
    if (this.xmlFragments[id]) {
      this.xmlFragments[id].delete(0, this.xmlFragments[id].length);
    }
    delete this.xmlFragments[id]
  }

  deleteEditor(id: any) {
    let deleteContainer = this.editorContainers[id];
    if (deleteContainer) {
      this.editorContainers[id].editorView.destroy();
      delete this.editorContainers[id]
    }
  }

  clearDeleteArray() {
    while (this.editorsDeleteArray.length > 0) {
      let deleteId = this.editorsDeleteArray.shift()!;
      this.deleteEditor(deleteId)
      this.deleteXmlFragment(deleteId)
    }
  }

  addEditorForDelete(editorId: string) {
    this.commentsService.removeEditorComment(editorId)
    this.editorsDeleteArray.push(editorId);
  }

  resetProsemirrorEditors() {
    this.ydoc = undefined;
    //provider?: WebrtcProvider;
    this.provider = undefined;

    this.articleSectionsStructure = undefined;
    this.initDocumentReplace = {};
    this.editorContainers = {}
    this.xmlFragments = {}

    this.interpolateTemplate = undefined;
    this.userInfo = undefined;
    this.permanentUserData = undefined;
    this.trackChangesMeta = undefined;
    this.shouldTrackChanges = false
    this.treeChangesCount = 0
    this.transactionCount = 0;

    this.editorsEditableObj = {}

    this.mobileVersionSubject = new Subject<boolean>()
    this.mobileVersion = false;

    this.defaultValuesObj = {}
    this.editorsDeleteArray = []
    this.userData = undefined;
    this.deletedCitatsInPopUp = {}
  }

  dispatchEmptyTransaction() {  // for updating the view
    Object.values(this.editorContainers).forEach((container: any) => {
      let editorState = container.editorView.state as EditorState
      container.editorView.dispatch(editorState.tr.setMeta('emptyTR', true).setMeta('addToLastHistoryGroup', true))
    })
  }

  getEditorSelection(editorId: string) {
    let from = this.editorContainers[editorId].editorView.state.selection.from;
    let to = this.editorContainers[editorId].editorView.state.selection.to;
    return { from, to }
  }

  changeSelectionOfEditorAndFocus(id: string, sel: { from: number, to: number }) {
    let view = this.editorContainers[id].editorView;
    /* if(sel.from == sel.to){
      view.dispatch(view.state.tr.setSelection(new TextSelection(view.state.doc.resolve(sel.from))))
    }else{
      view.dispatch(view.state.tr.setSelection(new TextSelection(view.state.doc.resolve(sel.from),view.state.doc.resolve(sel.to))))
    } */
    //view.focus()
  }

  inlineMathInputRuleGlobal = makeInlineMathInputRule(REGEX_INLINE_MATH_DOLLARS, schema.nodes.math_inline, (match: any) => { return { math_id: uuidv4() } });
  blockMathInputRuleGlobal = this.makeBlockMathInputRule(REGEX_BLOCK_MATH_DOLLARS, schema.nodes.math_display, (match: any) => { return { math_id: uuidv4() } });

  scrollMainEditorIntoView(id: string) {
    try {
      let container = this.editorContainers[id];
      if (container) {
        let editorState = container.editorView.state as EditorState
        container.editorView.dispatch(editorState.tr.scrollIntoView())
      }
    } catch (e) {
      console.error(e);
    }
  }

  buildSchemaFromKeysDef(def:{nodes:string[],marks:string[]}){
    let nodes = {}
    let marks = {}
    def.nodes.forEach((nodeName)=>{
      nodes[nodeName] = nodesDefinitions[nodeName]
    })
    def.marks.forEach((nodeMark)=>{
      marks[nodeMark] = marksDefinitions[nodeMark]
    })
    return new Schema({nodes,marks});
  }

  getMenusAndSchemaDefsImportantForSection(sectionID){
    let menuAndSchemasDefsObj = this.ydocService.PMMenusAndSchemasDefsMap.get('menusAndSchemasDefs');
    let layoutMenusAndSchamasDefs = menuAndSchemasDefsObj['layoutDefinitions'];
    let menusAndSchemasForCitableElements = menuAndSchemasDefsObj['citableElementMenusAndSchemaDefs'];
    let editorMenusAndSchemasDefs = menuAndSchemasDefsObj[sectionID];
    let importantMenusDefsForSection = {...(layoutMenusAndSchamasDefs||{menus:{},schemas:{}}).menus,...(editorMenusAndSchemasDefs||{menus:{},schemas:{}}).menus}
    let importantScehmasDefsForSection = {...(layoutMenusAndSchamasDefs||{menus:{},schemas:{}}).schemas,...(editorMenusAndSchemasDefs||{menus:{},schemas:{}}).schemas}
    return {importantMenusDefsForSection,importantScehmasDefsForSection,menusAndSchemasForCitableElements}
  }

  renderEditorInWithId(EditorContainer: HTMLDivElement, editorId: string, section: articleSection): editorContainer {
    let hideshowPluginKEey = this.trackChangesService.hideshowPluginKey;

    if (this.editorContainers[editorId]) {
      EditorContainer.appendChild(this.editorContainers[editorId].containerDiv);
      return this.editorContainers[editorId];
    }
    let editorSchema = schema;

    let inlineMathInputRule
    let blockMathInputRule
    if(editorSchema.nodes.math_inline&&editorSchema.nodes.math_display){
      inlineMathInputRule = makeInlineMathInputRule(REGEX_INLINE_MATH_DOLLARS, editorSchema.nodes.math_inline, (match: any) => { return { math_id: uuidv4() } });
      blockMathInputRule = this.makeBlockMathInputRule(REGEX_BLOCK_MATH_DOLLARS, editorSchema.nodes.math_display, (match: any) => { return { math_id: uuidv4() } });
    }


    if(section.sectionMenusAndSchemasDefsfromJSONByfieldsTags){
      this.globalMenusAndSchemasSectionsDefs[section.sectionID] = section.sectionMenusAndSchemasDefsfromJSONByfieldsTags
    }

    let container = document.createElement('div');
    let editorView: EditorView;
    let colors = this.colors
    let colorMapping = this.colorMapping
    let permanentUserData = this.permanentUserData
    let editorID = editorId;

    let {importantMenusDefsForSection,menusAndSchemasForCitableElements}  = this.getMenusAndSchemaDefsImportantForSection(editorID)
    let menuTypes = this.menuService.buildPassedMenuTypes({...importantMenusDefsForSection,...menusAndSchemasForCitableElements.allCitableElementsMenus})
    let menuContainerClass = "menu-container";
    let xmlFragment = this.getXmlFragment(section.mode, editorID)
    let yjsPlugins = [ySyncPlugin(xmlFragment, { colors, colorMapping, permanentUserData }),
    yCursorPlugin(this.provider!.awareness, this.serviceShare, this.userData)
    ]

    container.setAttribute('class', 'editor-container');
    //let fullMenu1 = this.menuService.attachMenuItems(this.menu, this.ydoc!, 'fullMenu1', editorID);
    this.initDocumentReplace[editorID] = true;
    let transactionControllerPluginKey = new PluginKey('transactionControllerPlugin');
    let GroupControl = this.treeService.sectionFormGroups;
    let transactionControllerPlugin = new Plugin({
      key: transactionControllerPluginKey,
      appendTransaction: updateControlsAndFigures(editorSchema, this.ydocService.figuresMap!, this.ydocService.mathMap!, this.editorContainers, this.rerenderFigures, this.yjsHistory.YjsHistoryKey, this.interpolateTemplate, this.serviceShare, GroupControl, section),
      filterTransaction: preventDragDropCutOnNoneditablenodes(this.ydocService.figuresMap!, this.ydocService.mathMap!, this.rerenderFigures, editorID, this.serviceShare),
      //@ts-ignore
      historyPreserveItems: true,
    })

    let handleRefDeletePluginKey = new PluginKey('handleRefDelete');
    let handleRefDelete = new Plugin({
      key: handleRefDeletePluginKey,
      appendTransaction: handleDeleteOfRefsFigsCitationsAndComments(this.serviceShare)
    })

    let changeNodesKey = new PluginKey('changeNodesKey');
    let changeNodes = new Plugin({
      key: changeNodesKey,
      appendTransaction: changeNodesOnDragDrop(this.serviceShare),
    })

    let selectWholeCitatPluginKey = new PluginKey('selectWholeCitat');
    let selectWholeCitat = new Plugin({
      key: selectWholeCitatPluginKey,
      props: {
        createSelectionBetween: selectWholeCitatMarksAndRefCitatNode
      }
    })
    let handlePasteInSelWithInsAndDelPluginKey = new PluginKey('handleTCpaste');
    let handlePasteInSelWithInsAndDelPlugin = new Plugin({
      key:handlePasteInSelWithInsAndDelPluginKey,
      props:{
        handlePaste(view,event,slice){
          //@ts-ignore
          let delNode:any
          let delNodeStartpos:any
          let delNodeEndpos:any
          let actualDelMark:any

          let insNode:any
          let insNodeStartpos:any
          let insNodeEndpos:any
          let actualInsMark:any

          let from = view.state.selection.from;
          let to = view.state.selection.to
          let textnodeWithNoMarks = false;
          view.state.doc.nodesBetween(from,to,(node,pos)=>{
            let delmark = node.marks.find((mark)=>mark.type.name=="deletion")
            let deleteMarkInNode = delmark?node:undefined;
            actualDelMark = delmark;
            let insmark = node.marks.find((mark)=>mark.type.name=="insertion")
            let insertionMarkInNode = insmark?node:undefined;
            actualInsMark = insmark;

            if(node.type.name == 'text'){
              if(deleteMarkInNode&&!delNode){
                delNode = deleteMarkInNode
                delNodeStartpos = pos
                delNodeEndpos = pos+node.nodeSize
              }else if(insertionMarkInNode&&!insNode){
                insNode = insertionMarkInNode
                insNodeStartpos = pos
                insNodeEndpos = pos+node.nodeSize
              }else if(node.marks.length == 0){
                textnodeWithNoMarks = true;
              }
            }
          })
          if(!textnodeWithNoMarks&&delNode&&insNode){

            setTimeout(()=>{
              if(insNodeStartpos<from&&from<insNodeEndpos){ //  the start of the selection in insertion node
                //should set new sel from=from to=insNodeEndpos
                view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.tr.doc.resolve(from),view.state.tr.doc.resolve(insNodeEndpos),-1)).replaceSelection(slice))
              }else if(insNodeStartpos<to&&to<insNodeEndpos){//  the end of the selection in insertion node
                //should set new sel from=insNodeStartpos to=to
                view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.tr.doc.resolve(insNodeStartpos),view.state.tr.doc.resolve(to),1)).replaceSelection(slice))
              }
            },10)
            return true;
          }

          return false;
        },
      }
    })

    let previewModePluginKey = new PluginKey('selectWholeCitat');
    let previewModePlugin = new Plugin({
      key: previewModePluginKey,
      filterTransaction: (transaction, state) => {
        //@ts-ignore
        let meta = transaction.meta
        if (Object.keys(meta).includes("uiEvent")) {
          if (meta["uiEvent"] == 'drop') {
            if (this.previewArticleMode.mode) {
              return false
            }
          }
        }
        return true
      },
      props: {
        handleDOMEvents: {
          "cut": (view, event) => {
            if (this.previewArticleMode.mode) {
              event.preventDefault()
              return true;
            }
            return false;
          }
        },
        handlePaste: (plugin, view, slice) => {
          if (this.previewArticleMode.mode) {
            return true
          }
          return false;
        },
        transformPastedHTML: transformPastedHTML,
        handleDrop: (plugin, view, event, slice) => {
          if (this.previewArticleMode.mode) {
            return true
          }
          return false;
        }
      }
    })

    setTimeout(() => {
      this.initDocumentReplace[editorID] = false;
    }, 600);

    this.editorsEditableObj[editorID] = true

    let keymapObj = {
      'Mod-z': this.yjsHistory.undo,
      'Mod-y': this.yjsHistory.redo,
      'Mod-Shift-z': this.yjsHistory.redo,
      'Backspace': chainCommands(deleteSelection, mathBackspaceCmd, joinBackward, selectNodeBackward),
    }

    let inputRulesObj = { rules: [] }
    if(editorSchema.nodes.math_inline&&editorSchema.nodes.math_display){
      inputRulesObj.rules.push(inlineMathInputRule, blockMathInputRule)
    }
    if(editorSchema.nodes.table){
      keymapObj['Tab'] = goToNextCell(1)
      keymapObj['Shift-Tab'] = goToNextCell(-1)
    }

    if(editorSchema.nodes.math_inline){
      keymapObj['Mod-Space'] = insertMathCmd(editorSchema.nodes.math_inline)
    }
    let stateConfObj = {
      schema: editorSchema,
      plugins: [
        ...yjsPlugins,
        mathPlugin,
        keymap(keymapObj),
        this.placeholderPluginService.getPlugin(),
        getToolTipPlugin(this.serviceShare),
        getFilterNodesBySchemaDefPlugin(this.serviceShare),
        this.citableElementEditButtonsPluginService.citableElementsEditButtonsPlugin,
        this.linkButtonsPluginService.linkButtonsPlugin,
        this.citationButtonsService.citationButtonsPlugin,
        transactionControllerPlugin,
        handleRefDelete,
        changeNodes,
        handlePasteInSelWithInsAndDelPlugin,
        selectWholeCitat,
        previewModePlugin,
        // this.serviceShare.CitableElementsContextMenuService.getPlugin(),
        this.detectFocusService.getPlugin(),
        this.serviceShare.ReferencePluginService?.referencePlugin,
        this.commentsService.getPlugin(),
        this.serviceShare.TaxonService.getPlugin(),
        this.trackChangesService.getHideShowPlugin(),
        this.citatContextPluginService.citatContextPlugin,
        this.linkPopUpPluginService.linkPopUpPlugin,
        inputRules(inputRulesObj),
        ...menuBar({
          floating: true,
          clearPMUndoRedo:true,
          undoRedoMenuItems:this.undoRedoMenuItems,
          content: menuTypes, containerClass: menuContainerClass,serviceShare:this.serviceShare,sectionID: editorID
        }),
        this.yjsHistory.getYjsHistoryPlugin({ editorID, figuresMap: this.ydocService.figuresMap, renderFigures: this.rerenderFigures })
      ].concat(exampleSetup({ schema:editorSchema, /* menuContent: fullMenuWithLog, */history: false, containerClass: menuContainerClass }))
      ,
      // @ts-ignore
      sectionName: editorID,
      // @ts-ignore
      sectionID: editorID,
      // @ts-ignore
    }

    if(editorSchema.nodes.table){
      stateConfObj.plugins.push(columnResizing({}),tableEditing());
    }
    let edState = EditorState.create(stateConfObj);

    let mapping = new Mapping();
    let nodeType = 1;

    let lastStep: any
    let lastContainingInsertionMark: any
    const dispatchTransaction = (transaction: Transaction) => {
      this.transactionCount++
      try {
        let nodeAtSel = transaction.selection.$head.parent || transaction.selection.$anchor.parent
        //@ts-ignore
        if (nodeAtSel && !transaction.getMeta('titleupdateFromControl') && nodeAtSel.attrs.controlPath && nodeAtSel.attrs.controlPath == "sectionTreeTitle" && transaction.steps.filter(step => { return step instanceof ReplaceStep || step instanceof ReplaceAroundStep }).length > 0) {
          transaction.setMeta('editingTitle', true);
        }

        if(nodeAtSel?.lastChild?.type.name == "spacer") {
          return;
        }

        //@ts-ignore
        if (lastStep == transaction.steps[0] && !transaction.getMeta('emptyTR')) {
          if (lastStep) { return }
        }
        lastStep = transaction.steps[0]
        let isMath = false
        if (transaction.steps.length > 0) {
          if (transaction.selection instanceof NodeSelection && (transaction.selection.node.type.name == 'math_inline' || transaction.selection.node.type.name == 'math_display')) {
            let hasmarkAddRemoveStep = transaction.steps.filter((step) => {
              return (step instanceof AddMarkStep || step instanceof RemoveMarkStep)
            }).length > 0;
            if (hasmarkAddRemoveStep) {
              return
            }
            isMath = true
          }

          //@ts-ignore
          if (this.preventAddToHistory || transaction.getMeta('y-sync$') || transaction.meta['y-sync$']) {

          } else {
            let undoManager = this.yjsHistory.YjsHistoryKey.getState(editorView.state).undoManager;
            let undoManagerStatus = undoManager.status;
            if (undoManagerStatus !== 'capturing') {
              this.yjsHistory.YjsHistoryKey.getState(editorView.state).undoManager.status = 'capturing'
            }
          }
        }
        if (this.initDocumentReplace[editorID] || !this.shouldTrackChanges || transaction.getMeta('shouldTrack') == false || isMath) {

          let state = editorView?.state.apply(transaction);
          editorView?.updateState(state!);

        } else {
          const tr = trackedTransaction.default(transaction, editorView, editorView?.state,
            {
              userId: this.userInfo.data.id,
              username: this.userInfo.data.name,
              userColor: this.userInfo.color.userColor,
              userContrastColor: this.userInfo.color.userContrastColor
            }, lastContainingInsertionMark);
          if (editorView?.state.selection instanceof TextSelection && transaction.selectionSet) {
            let sel = editorView?.state.selection
            if (sel.$to.nodeAfter && sel.$to.nodeBefore) {
              let insertionMarkAfter = sel.$to.nodeAfter?.marks.filter(mark => mark.type.name == 'insertion')[0]
              let insertionMarkBefore = sel.$to.nodeBefore?.marks.filter(mark => mark.type.name == 'insertion')[0]
              if (sel.empty && insertionMarkAfter && insertionMarkAfter == insertionMarkBefore) {
                lastContainingInsertionMark = `${insertionMarkAfter.attrs.id}`
              } else if (
                (insertionMarkAfter && insertionMarkAfter.attrs.id == lastContainingInsertionMark) ||
                (insertionMarkBefore && insertionMarkBefore.attrs.id == lastContainingInsertionMark)) {
              } else {
                lastContainingInsertionMark = undefined
              }
            }
          }
          let state = editorView?.state.apply(tr);
          editorView?.updateState(state!);
        }
      } catch (err) { console.error(err); }
    };
    let mathMap = this.ydocService.mathMap

    editorView = new EditorView(container, {
      state: edState,
      clipboardTextSerializer: (slice: Slice) => {
        return mathSerializer.serializeSlice(slice);
      },
      editable: (state: EditorState) => {
        return !this.mobileVersion /* && this.editorsEditableObj[editorID] */
        // mobileVersion is true when app is in mobile mod | editable() should return return false to set editor not editable so we return !mobileVersion
      },
      handleTextInput(this, view, from, to, text) {
        let delNode:any
        let delNodeStartpos:any
        let delNodeEndpos:any
        let actualDelMark:any

        let insNode:any
        let insNodeStartpos:any
        let insNodeEndpos:any
        let actualInsMark:any

        let textnodeWithNoMarks = false;
        view.state.doc.nodesBetween(from,to,(node,pos)=>{
          let delmark = node.marks.find((mark)=>mark.type.name=="deletion")
          let deleteMarkInNode = delmark?node:undefined;
          actualDelMark = delmark;
          let insmark = node.marks.find((mark)=>mark.type.name=="insertion")
          let insertionMarkInNode = insmark?node:undefined;
          actualInsMark = insmark;

          if(node.type.name == 'text'){
            if(deleteMarkInNode&&!delNode){
              delNode = deleteMarkInNode
              delNodeStartpos = pos
              delNodeEndpos = pos+node.nodeSize
            }else if(insertionMarkInNode&&!insNode){
              insNode = insertionMarkInNode
              insNodeStartpos = pos
              insNodeEndpos = pos+node.nodeSize
            }else if(node.marks.length == 0){
              textnodeWithNoMarks = true;
            }
          }
        })
        if(!textnodeWithNoMarks&&delNode&&insNode){
          setTimeout(()=>{
            if(insNodeStartpos<from&&from<insNodeEndpos){ //  the start of the selection in insertion node
              //should set new sel from=from to=insNodeEndpos
              view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.tr.doc.resolve(from),view.state.tr.doc.resolve(insNodeEndpos),-1)).replaceSelectionWith(editorSchema.text(text,[actualInsMark])))
            }else if(insNodeStartpos<to&&to<insNodeEndpos){//  the end of the selection in insertion node
              //should set new sel from=insNodeStartpos to=to
              view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.tr.doc.resolve(insNodeStartpos),view.state.tr.doc.resolve(to),1)).replaceSelectionWith(editorSchema.text(text,[actualInsMark])))
            }
          },10)
          return true;
        }

        return false;
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          /* let state = view.state;
          let sel = state.selection
          state.doc.nodesBetween(sel.from, sel.to, (node, pos, parent, index) => {
            if (!this.previewArticleMode.mode && node.marks.length > 0 && (
              node.marks.filter((mark) => { return (mark.type.name == 'citation'||mark.type.name == 'table_citation') }).length > 0
              )) {
              setTimeout(() => {
                let cursurCoord = view.coordsAtPos(sel.from);
                event.preventDefault();
                event.stopPropagation();
                setTimeout(() => {
                  view.dispatch(view.state.tr.setMeta('citatContextPlugin', {
                    clickPos: sel.from,
                    clickEvent: event,
                    focus: view.hasFocus(),
                    coords: cursurCoord
                  }))
                }, 0)
                return true
              })
            }
          })
          if (this.citatContextPluginService.citatContextPluginKey.getState(view.state).decorations) {
            event.preventDefault();
            event.stopPropagation();
            return true
          } */
          return false
        }
      },
      dispatchTransaction,
      handlePaste: handlePaste(this.serviceShare),
      transformPastedHTML: transformPastedHTML,
      handleClick: handleClick(),
      handleClickOn: handleClickOn(),
      handleTripleClickOn,
      handleScrollToSelection: handleScrollToSelection(this.editorContainers, section),
      handleDoubleClick: handleDoubleClickFN(hideshowPluginKEey, this.serviceShare),
      handleKeyDown: handleKeyDown(this.serviceShare),
      scrollMargin: { top: 300, right: 5, bottom: 300, left: 5 },
    });
    //@ts-ignore
    editorView.globalMenusAndSchemasSectionsDefs = this.globalMenusAndSchemasSectionsDefs
    //@ts-ignore
    editorView.citableElementMenusAndSchemaDefs = menusAndSchemasForCitableElements
    //@ts-ignore
    editorView.sectionID = editorID
    //@ts-ignore
    editorView.editorType = 'editorWithCustomSchema'
    EditorContainer.appendChild(container);

    let editorCont: any = {
      editorID: editorID,
      containerDiv: container,
      editorState: edState,
      editorView: editorView,
      dispatchTransaction: dispatchTransaction
    };
    this.editorContainers[editorID] = editorCont;
    let count = 0;
    let countActiveSections = (item: articleSection) => {
      if (item.type == 'complex' && item.children.length > 0) {
        item.children.forEach((child) => {
          countActiveSections(child)
        })
      }
      if (item.active == true && item.mode != 'noSchemaSectionMode') {
        count++;
      }
    }
    this.treeService.articleSectionsStructure?.forEach(item => {
      countActiveSections(item)
    })
    let renderedSections = Object.keys(this.editorContainers).filter(key => (key !== 'endEditor'&&key!=='headEditor')).length
    let allActiveSections = count;
    if (renderedSections == allActiveSections) {
      this.runFuncAfterRender()
    }
    return editorCont
  }

  renderDocumentHeadEditor(EditorContainer: HTMLDivElement): editorContainer {
    let editorId = 'headEditor'

    if (this.editorContainers[editorId]) {
      EditorContainer.appendChild(this.editorContainers[editorId].containerDiv);
      return this.editorContainers[editorId]
    }

    let container = document.createElement('div');
    let editorView: EditorView;
    let colors = this.colors
    let colorMapping = this.colorMapping
    let permanentUserData = this.permanentUserData
    let editorID = editorId;

    let menuContainerClass = "menu-container";
    let xmlFragment = this.getXmlFragment('documentMode', editorID)
    let yjsPlugins = [ySyncPlugin(xmlFragment, { colors, colorMapping, permanentUserData }),
    yCursorPlugin(this.provider!.awareness, this.serviceShare, this.userData),
    ]

    container.setAttribute('class', 'editor-container');
    this.initDocumentReplace[editorID] = true;


    setTimeout(() => {
      this.initDocumentReplace[editorID] = false;
    }, 600);

    this.editorsEditableObj[editorID] = true
    let edState = EditorState.create({
      schema: schema,
      plugins: [
        ...yjsPlugins,
        mathPlugin,
        keymap({
          'Mod-z': this.yjsHistory.undo,
          'Mod-y': this.yjsHistory.redo,
          'Mod-Shift-z': this.yjsHistory.undo,
          'Backspace': chainCommands(deleteSelection, mathBackspaceCmd, joinBackward, selectNodeBackward),
          'Tab': goToNextCell(1),
          'Shift-Tab': goToNextCell(-1)
        }),
        getToolTipPlugin(this.serviceShare),
        this.yjsHistory.getYjsHistoryPlugin({ editorID, figuresMap: this.ydocService.figuresMap, renderFigures: this.rerenderFigures }),
        ...menuBar({
          floating: true,
          clearPMUndoRedo:true,
          undoRedoMenuItems:this.undoRedoMenuItems,
          content: this.menuTypes, containerClass: menuContainerClass,serviceShare:this.serviceShare,sectionID: editorID
        })
      ].concat(exampleSetup({ schema, /* menuContent: fullMenuWithLog, */history: false, containerClass: menuContainerClass }))
      ,
      // @ts-ignore
      sectionName: editorID,
      // @ts-ignore
      sectionID: editorID,
      // @ts-ignore
    });

    let lastStep: any

    const dispatchTransaction = (transaction: Transaction) => {
      this.transactionCount++
      try {
        if (lastStep == transaction.steps[0] && !transaction.getMeta('emptyTR')) {
          if (lastStep) { return }
        }
        let isMath = false
        if (transaction.selection instanceof NodeSelection && (transaction.selection.node.type.name == 'math_inline' || transaction.selection.node.type.name == 'math_display')) {
          let hasmarkAddRemoveStep = transaction.steps.filter((step) => {
            return (step instanceof AddMarkStep || step instanceof RemoveMarkStep)
          }).length > 0;
          if (hasmarkAddRemoveStep) {
            return
          }
          isMath = true
        }
        lastStep = transaction.steps[0];
        if (transaction.steps.length > 0) {
          let undoManager = this.yjsHistory.YjsHistoryKey.getState(editorView.state).undoManager;
          let undoManagerStatus = undoManager.status;

          //@ts-ignore
          if (this.preventAddToHistory || transaction.getMeta('y-sync$') || transaction.meta['y-sync$']) {
          } else {
            if (undoManagerStatus !== 'capturing') {
              this.yjsHistory.YjsHistoryKey.getState(editorView.state).undoManager.status = 'capturing'
            }
          }
        }
        let state = editorView?.state.apply(transaction);
        editorView?.updateState(state!);
      } catch (err) { console.error(err); }
    };
    editorView = new EditorView(container, {
      state: edState,
      clipboardTextSerializer: (slice: Slice) => {
        return mathSerializer.serializeSlice(slice);
      },
      editable: (state: EditorState) => {
        /*return !this.mobileVersion  && this.editorsEditableObj[editorID] */
        return false
        // mobileVersion is true when app is in mobile mod | editable() should return return false to set editor not editable so we return !mobileVersion
      },
      dispatchTransaction,
      handleClick: handleClick(),
      handleClickOn: handleClickOn(),
      handlePaste: handlePaste(this.serviceShare),
      transformPastedHTML: transformPastedHTML,
      handleTripleClickOn,
      handleKeyDown: handleKeyDown(this.serviceShare),
    });
    EditorContainer.appendChild(container);

    let editorCont: any = {
      editorID: editorID,
      containerDiv: container,
      editorState: edState,
      editorView: editorView,
      dispatchTransaction: dispatchTransaction
    };
    this.editorContainers[editorID] = editorCont;

    let count = 0;
    let countActiveSections = (item: articleSection) => {
      if (item.type == 'complex' && item.children.length > 0) {
        item.children.forEach((child) => {
          countActiveSections(child)
        })
      }
      if (item.active == true && item.mode != 'noSchemaSectionMode') {
        count++;
      }
    }
    this.treeService.articleSectionsStructure?.forEach(item => {
      countActiveSections(item)
    })
    if (count == 0) {
      this.runFuncAfterRender()
    }

    return editorCont
  }

  endDocIsEmpty = true;

  renderDocumentEndEditor(EditorContainer: HTMLDivElement): editorContainer {
    let editorId = 'endEditor'
    let hideshowPluginKEey = this.trackChangesService.hideshowPluginKey;


    if (this.editorContainers[editorId]) {
      EditorContainer.appendChild(this.editorContainers[editorId].containerDiv);
      return this.editorContainers[editorId]
    }

    let {importantMenusDefsForSection,menusAndSchemasForCitableElements}  = this.getMenusAndSchemaDefsImportantForSection(editorId)
    let menuTypes = this.menuService.buildPassedMenuTypes({...importantMenusDefsForSection,...menusAndSchemasForCitableElements.allCitableElementsMenus});

    let transactionControllerPluginKey = new PluginKey('transactionControllerPlugin');
    let transactionControllerPlugin = new Plugin({
      key: transactionControllerPluginKey,
      appendTransaction: updateControlsAndFigures(schema, this.ydocService.figuresMap!, this.ydocService.mathMap!, this.editorContainers, this.rerenderFigures, this.interpolateTemplate, this.yjsHistory.YjsHistoryKey, this.serviceShare),
      filterTransaction: preventDragDropCutOnNoneditablenodes(this.ydocService.figuresMap!, this.ydocService.mathMap!, this.rerenderFigures, editorId, this.serviceShare),
    })
    let divideEndEditorFromTopPluginKey = new PluginKey('divideEndEditorFromTopPluginKey');
    let divideEndEditorFromTopPlugin = new Plugin({
      key: divideEndEditorFromTopPluginKey,
      state:{
        init(){

        },
        apply : (tr,val,oldstate,newState)=>{
          if(newState.doc.content.size == 0){
            this.endDocIsEmpty = true;
          }else{
            this.endDocIsEmpty = false;

          }
        }
      }
    })

    let container = document.createElement('div');
    let editorView: EditorView;
    let colors = this.colors
    let colorMapping = this.colorMapping
    let permanentUserData = this.permanentUserData
    let editorID = editorId;

    let menuContainerClass = "menu-container";
    let xmlFragment = this.getXmlFragment('documentMode', editorID)
    let yjsPlugins = [ySyncPlugin(xmlFragment, { colors, colorMapping, permanentUserData }),
    yCursorPlugin(this.provider!.awareness, this.serviceShare, this.userData),
    ]

    container.setAttribute('class', 'editor-container');
    this.initDocumentReplace[editorID] = true;


    setTimeout(() => {
      this.initDocumentReplace[editorID] = false;
    }, 600);
    this.editorsEditableObj[editorID] = true
    let edState = EditorState.create({
      schema: schema,
      plugins: [
        ...yjsPlugins,
        mathPlugin,
        keymap({
          'Mod-z': this.yjsHistory.undo,
          'Mod-y': this.yjsHistory.redo,
          'Mod-Shift-z': this.yjsHistory.undo,
          //'Mod-Space': insertMathCmd(endEditorSchema!.nodes.math_inline),
          'Backspace': chainCommands(deleteSelection, mathBackspaceCmd, joinBackward, selectNodeBackward),
          'Tab': goToNextCell(1),
          'Shift-Tab': goToNextCell(-1)
        }),
        columnResizing({}),
        tableEditing(),
        //this.placeholderPluginService.getPlugin(),
        transactionControllerPlugin,
        getToolTipPlugin(this.serviceShare),
        this.detectFocusService.getPlugin(),
        getFilterNodesBySchemaDefPlugin(this.serviceShare),
        // this.serviceShare.CitableElementsContextMenuService.getPlugin(),
        divideEndEditorFromTopPlugin,
        this.serviceShare.ReferencePluginService?.referencePlugin,
        this.serviceShare.TaxonService.getPlugin(),
        this.commentsService.getPlugin(),
        this.citableElementEditButtonsPluginService.citableElementsEditButtonsPlugin,
        this.linkButtonsPluginService.linkButtonsPlugin,
        this.citationButtonsService.citationButtonsPlugin,
        this.trackChangesService.getHideShowPlugin(),
        this.linkPopUpPluginService.linkPopUpPlugin,
        //inputRules({ rules: [inlineMathInputRule, blockMathInputRule] }),
        this.yjsHistory.getYjsHistoryPlugin({ editorID, figuresMap: this.ydocService.figuresMap, renderFigures: this.rerenderFigures }),
        ...menuBar({
          floating: true,
          clearPMUndoRedo:true,
          undoRedoMenuItems:this.undoRedoMenuItems,
          content: menuTypes, containerClass: menuContainerClass,serviceShare:this.serviceShare,sectionID: editorID
        })
      ].concat(exampleSetup({ schema, /* menuContent: fullMenuWithLog, */history: false, containerClass: menuContainerClass }))
      ,
      // @ts-ignore
      sectionName: editorID,
      // @ts-ignore
      sectionID: editorID,
      // @ts-ignore
    });

    let lastStep: any
    let lastContainingInsertionMark: any

    const dispatchTransaction = (transaction: Transaction) => {
      this.transactionCount++
      try {
        const firstChild = transaction.doc.firstChild;
        if(firstChild?.type.name == "paragraph") return;
        if (lastStep == transaction.steps[0] && !transaction.getMeta('emptyTR')) {
          if (lastStep) { return }
        }

        let nodeAtSel = transaction.selection.$head.parent || transaction.selection.$anchor.parent
        if(nodeAtSel?.lastChild?.type.name == "spacer") {
          return;
        }

        let isMath = false
        if (transaction.selection instanceof NodeSelection && (transaction.selection.node.type.name == 'math_inline' || transaction.selection.node.type.name == 'math_display')) {
          let hasmarkAddRemoveStep = transaction.steps.filter((step) => {
            return (step instanceof AddMarkStep || step instanceof RemoveMarkStep)
          }).length > 0;
          if (hasmarkAddRemoveStep) {
            return
          }
          isMath = true
        }
        lastStep = transaction.steps[0];
        if (transaction.steps.length > 0) {
          let undoManager = this.yjsHistory.YjsHistoryKey.getState(editorView.state).undoManager;
          let undoManagerStatus = undoManager.status;

          //@ts-ignore
          if (this.preventAddToHistory || transaction.getMeta('y-sync$') || transaction.meta['y-sync$']) {
          } else {
            if (undoManagerStatus !== 'capturing') {
              this.yjsHistory.YjsHistoryKey.getState(editorView.state).undoManager.status = 'capturing'
            }
          }
        }
        if (this.initDocumentReplace[editorID] || !this.shouldTrackChanges || transaction.getMeta('shouldTrack') == false || isMath) {

          let state = editorView?.state.apply(transaction);
          editorView?.updateState(state!);

        } else {
          const tr = trackedTransaction.default(transaction, editorView, editorView?.state,
            {
              userId: this.userInfo.data.id,
              username: this.userInfo.data.name,
              userColor: this.userInfo.color.userColor,
              userContrastColor: this.userInfo.color.userContrastColor
            }, lastContainingInsertionMark);
          if (transaction.selection instanceof TextSelection) {
            let sel = transaction.selection
            if (sel.$to.nodeAfter && sel.$to.nodeBefore) {

              let insertionMarkAfter = sel.$to.nodeAfter?.marks.filter(mark => mark.type.name == 'insertion')[0]
              let insertionMarkBefore = sel.$to.nodeBefore?.marks.filter(mark => mark.type.name == 'insertion')[0]
              if (sel.empty && insertionMarkAfter && insertionMarkAfter == insertionMarkBefore) {
                lastContainingInsertionMark = `${insertionMarkAfter.attrs.id}`
              } else if (
                (insertionMarkAfter && insertionMarkAfter.attrs.id == lastContainingInsertionMark) ||
                (insertionMarkBefore && insertionMarkBefore.attrs.id == lastContainingInsertionMark)) {
              } else {
                lastContainingInsertionMark = undefined
              }
            }
          }
          let state = editorView?.state.apply(tr);
          editorView?.updateState(state!);
        }
      } catch (err) { console.error(err); }
    };
    editorView = new EditorView(container, {
      state: edState,
      clipboardTextSerializer: (slice: Slice) => {
        return mathSerializer.serializeSlice(slice);
      },
      editable: (state: EditorState) => {
        /*return !this.mobileVersion  && this.editorsEditableObj[editorID] */
        return true
        // mobileVersion is true when app is in mobile mod | editable() should return return false to set editor not editable so we return !mobileVersion
      },
      dispatchTransaction,
      handleClick: handleClick(),
      handleClickOn: handleClickOn(),
      handlePaste: handlePaste(this.serviceShare),
      transformPastedHTML: transformPastedHTML,
      handleTripleClickOn,
      handleDoubleClick: handleDoubleClickFN(hideshowPluginKEey, this.serviceShare),
      handleKeyDown: handleKeyDown(this.serviceShare),
      //createSelectionBetween:createSelectionBetween(this.editorsEditableObj,editorID),
    });
    EditorContainer.appendChild(container);
    //@ts-ignorer
    editorView.citableElementMenusAndSchemaDefs = menusAndSchemasForCitableElements
    //@ts-ignore
    editorView.globalMenusAndSchemasSectionsDefs = this.globalMenusAndSchemasSectionsDefs
    //@ts-ignore
    editorView.editorType = 'editorWithCustomSchema'
    let editorCont: any = {
      editorID: editorID,
      containerDiv: container,
      editorState: edState,
      editorView: editorView,
      dispatchTransaction: dispatchTransaction
    };
    this.editorContainers[editorID] = editorCont;

    let count = 0;
    let countActiveSections = (item: articleSection) => {
      if (item.type == 'complex' && item.children.length > 0) {
        item.children.forEach((child) => {
          countActiveSections(child)
        })
      }
      if (item.active == true && item.mode != 'noSchemaSectionMode') {
        count++;
      }
    }
    this.treeService.articleSectionsStructure?.forEach(item => {
      countActiveSections(item)
    })
    if (count == 0) {
      this.runFuncAfterRender()
    }

    return editorCont
  }

  renderEditorWithNoSync(EditorContainer: HTMLDivElement, formIOComponentInstance: any, control: FormioControl, options: any, nodesArray?: Slice): editorContainer {
    let sectionID = options.sectionID
    let menuTypes = this.menuTypes
    let editorSchema = schema
    let importantMenusDefsForSectionPrim,importantScehmasDefsForSectionPrim
    let citableElementMenusAndSchemaDefs
    if(sectionID){
      let {importantMenusDefsForSection,importantScehmasDefsForSection,menusAndSchemasForCitableElements} = this.getMenusAndSchemaDefsImportantForSection(sectionID)
      citableElementMenusAndSchemaDefs = menusAndSchemasForCitableElements
      importantMenusDefsForSectionPrim = importantMenusDefsForSection
      importantScehmasDefsForSectionPrim = importantScehmasDefsForSection
      menuTypes = this.menuService.buildPassedMenuTypes(importantMenusDefsForSection)
    }else if(options.isCitableElement){
      let {importantMenusDefsForSection,importantScehmasDefsForSection,menusAndSchemasForCitableElements} = this.getMenusAndSchemaDefsImportantForSection(sectionID)
      importantMenusDefsForSectionPrim = {...menusAndSchemasForCitableElements.allCitableElementsMenus,...importantMenusDefsForSection}
      importantScehmasDefsForSectionPrim = {...menusAndSchemasForCitableElements.allCitableElementsSchemas,...importantScehmasDefsForSection}
      menuTypes = this.menuService.buildPassedMenuTypes(importantMenusDefsForSectionPrim)
      if(nodesArray&&options.allowedTags&&importantScehmasDefsForSectionPrim[options.allowedTags]){

      }
    }
    let CustomDOMPMSerializer = DOMSerializer.fromSchema(editorSchema)
    let placeholder = (formIOComponentInstance.component.placeholder && formIOComponentInstance.component.placeholder !== '') ? formIOComponentInstance.component.placeholder : undefined
    let hideshowPluginKEey = this.trackChangesService.hideshowPluginKey;
    EditorContainer.innerHTML = ''
    let editorID = random.uuidv4()
    let container = document.createElement('div');
    let editorView: EditorView;
    let doc: Node;

    let inlineMathInputRule
    let blockMathInputRule
    if(editorSchema.nodes.math_inline&&editorSchema.nodes.math_display){
      inlineMathInputRule = makeInlineMathInputRule(REGEX_INLINE_MATH_DOLLARS, editorSchema.nodes.math_inline, (match: any) => { return { math_id: uuidv4() } });
      blockMathInputRule = this.makeBlockMathInputRule(REGEX_BLOCK_MATH_DOLLARS, editorSchema.nodes.math_display, (match: any) => { return { math_id: uuidv4() } });
    }
    /*if (!options.noLabel) {
      let componentLabel = formIOComponentInstance.component.label;
      let labelTag = document.createElement('div');
      labelTag.setAttribute('class', 'prosemirror-label-tag')
      labelTag.textContent = componentLabel
      EditorContainer.appendChild(labelTag);
    } */
    let allowedTags = ''
    if(options.allowedTags && options.allowedTags.length>0 ){
      allowedTags = options.allowedTags
    }
    
    if (options.path == 'tableContent') {
      if (nodesArray?.content) {
        doc = editorSchema.nodes.doc.create({}, editorSchema.nodes.form_field.create({allowedTags, styling: "min-height: 80px; width: 100%;"}, nodesArray?.content))
      } else {
        doc = editorSchema.nodes.doc.create({}, editorSchema.nodes.form_field.create({allowedTags, styling: "min-height: 80px; width: 100%;"}))
      }
    } else if ((!nodesArray || nodesArray.size == 0)) {
      doc = editorSchema.nodes.doc.create({}, editorSchema.nodes.form_field.create({allowedTags}, editorSchema.nodes.paragraph.create({})))
    } else {
      doc = editorSchema.nodes.doc.create({}, editorSchema.nodes.form_field.create({allowedTags}, nodesArray.content))
    }
    let menuContainerClass = "popup-menu-container";

    container.setAttribute('class', 'editor-container');



    let filterTransaction = false

    let transactionControllerPluginKey = new PluginKey('transactionControllerPlugin');
    let transactionControllerPlugin = new Plugin({
      key: transactionControllerPluginKey,
      props: {
        createSelectionBetween: selectWholeCitatMarksAndRefCitatNode
      },
      state: {
        init(config:any) {
          return { sectionID: config.sectionID }
        },
        apply(tr, prev, _, newState) {
          return prev
        }
      },
      appendTransaction: (trs: Transaction[], oldState: EditorState, newState: EditorState) => {
        let containerElement = document.createElement('div');
        let htmlNOdeRepresentation
        if(options.rawNodeContent){
          htmlNOdeRepresentation = CustomDOMPMSerializer.serializeFragment(newState.doc.content)
        }else{
          htmlNOdeRepresentation = CustomDOMPMSerializer.serializeFragment(newState.doc.content.firstChild!.content)
        }
        containerElement.appendChild(htmlNOdeRepresentation);
        options.onChange(true, containerElement.innerHTML)
        return newState.tr
      },
      filterTransaction: preventDragDropCutOnNoneditablenodes(this.ydocService.figuresMap!, this.ydocService.mathMap!, this.rerenderFigures, sectionID, this.serviceShare)

    })

    /*fieldFormControl?.valueChanges.subscribe((data) => {

       let tr = recreateTransform(
        doc ,
        endDoc,
        complexSteps = true, // Whether step types other than ReplaceStep are allowed.
        wordDiffs = false // Whether diffs in text nodes should cover entire words.
      )
    })*/

    this.editorsEditableObj[editorID] = true
    let menu: any = undefined
    if (options.menuType) {
      if(menuTypes[options.menuType]){
        menu = { main: menuTypes[options.menuType] }
      }else{
        menu = { main: menuTypes['main'] };
        console.error(`There is no menu def with this name ["${options.menuType}"]. Available menu defs are : ["${Object.keys(importantMenusDefsForSectionPrim).join('","')}"]`)
      }
    }
    let keymapObj = {
      'Mod-z': undo,
      'Mod-y': redo,
      'Mod-Shift-z': redo,
      'Backspace': chainCommands(deleteSelection, mathBackspaceCmd, joinBackward, selectNodeBackward),

    }
    let inputRulesObj = { rules: [] }
    if(editorSchema.nodes.math_inline&&editorSchema.nodes.math_display){
      inputRulesObj.rules.push(inlineMathInputRule, blockMathInputRule)
    }
    if(editorSchema.nodes.table){
      keymapObj['Tab'] = goToNextCell(1)
      keymapObj['Shift-Tab'] = goToNextCell(-1)
    }

    if(editorSchema.nodes.math_inline){
      keymapObj['Mod-Space'] = insertMathCmd(editorSchema.nodes.math_inline)
    }
    let menus = menu ? menu : menuTypes;
    let stateConfObj = {
      doc,
      schema: editorSchema,
      plugins: [
        mathPlugin,
        keymap(keymapObj),
        getFilterNodesBySchemaDefPlugin(this.serviceShare),
        this.citationButtonsService.citationButtonsPlugin,
        this.placeholderPluginService.getPlugin(),
        transactionControllerPlugin,
        this.trackChangesService.getHideShowPlugin(),
        inputRules(inputRulesObj),
        ...menuBar({
          floating: true,
          clearYJSUndoRedo:true,
          undoRedoMenuItems:this.undoRedoMenuItems,
          content: menus, containerClass: menuContainerClass
        })
      ].concat(exampleSetup({ schema:editorSchema, /* menuContent: fullMenuWithLog, */ containerClass: menuContainerClass }))
      ,
      // @ts-ignore
      data: { placeHolder: placeholder, path: options.path },
      // @ts-ignore
      sectionName: editorID,
      sectionID: sectionID,
      editorType: 'popupEditor'
    }

    if(editorSchema.nodes.table){
      stateConfObj.plugins.push(columnResizing({}),tableEditing());
    }



    let edState = EditorState.create(stateConfObj);
    setTimeout(() => {
      this.initDocumentReplace[editorID] = false;
    }, 600);

    this.editorsEditableObj[editorID] = true
    let lastStep: any
    let lastContainingInsertionMark: any
    const dispatchTransaction = (transaction: Transaction) => {
      this.transactionCount++
      try {
        if (lastStep == transaction.steps[0]) {
          if (lastStep) { return }
        }
        lastStep = transaction.steps[0]
        let isMath = false;
        if (transaction.selection instanceof NodeSelection && (transaction.selection.node.type.name == 'math_inline' || transaction.selection.node.type.name == 'math_display')) {
          let hasmarkAddRemoveStep = transaction.steps.filter((step) => {
            return (step instanceof AddMarkStep || step instanceof RemoveMarkStep)
          }).length > 0;
          if (hasmarkAddRemoveStep) {
            return
          }
          isMath = true
        }
        if (this.initDocumentReplace[editorID] || !this.shouldTrackChanges || transaction.getMeta('shouldTrack') == false || isMath) {
          let state = editorView?.state.apply(transaction);
          editorView?.updateState(state!);

        } else {
          const tr = trackedTransaction.default(transaction, editorView, editorView?.state,
            {
              userId: this.userInfo.data.id,
              username: this.userInfo.data.name,
              userColor: this.userInfo.color.userColor,
              userContrastColor: this.userInfo.color.userContrastColor
            }, lastContainingInsertionMark);
          if (editorView?.state.selection instanceof TextSelection && transaction.selectionSet) {
            let sel = editorView?.state.selection
            if (sel.$to.nodeAfter && sel.$to.nodeBefore) {
              let insertionMarkAfter = sel.$to.nodeAfter?.marks.filter(mark => mark.type.name == 'insertion')[0]
              let insertionMarkBefore = sel.$to.nodeBefore?.marks.filter(mark => mark.type.name == 'insertion')[0]
              if (sel.empty && insertionMarkAfter && insertionMarkAfter == insertionMarkBefore) {
                lastContainingInsertionMark = `${insertionMarkAfter.attrs.id}`
              } else if (
                (insertionMarkAfter && insertionMarkAfter.attrs.id == lastContainingInsertionMark) ||
                (insertionMarkBefore && insertionMarkBefore.attrs.id == lastContainingInsertionMark)) {
              } else {
                lastContainingInsertionMark = undefined
              }
            }
          }

          let state = editorView?.state.apply(tr);
          editorView?.updateState(state!);
        }
      } catch (err) { console.error(err); }
    };
    editorView = new EditorView(container, {
      state: edState,
      clipboardTextSerializer: (slice: Slice) => {
        return mathSerializer.serializeSlice(slice);
      },
      editable: (state: EditorState) => {
        return !this.mobileVersion && this.editorsEditableObj[editorID]
        // mobileVersion is true when app is in mobile mod | editable() should return return false to set editor not editable so we return !mobileVersion
      },
      dispatchTransaction,
      handleClick: handleClick(),
      handlePaste: handlePaste(this.serviceShare, options),
      transformPastedHTML: transformPastedHTML,
      handleTripleClickOn,
      handleDoubleClick:
      handleDoubleClickFN(hideshowPluginKEey, this.serviceShare),
      handleKeyDown: handleKeyDown(this.serviceShare, options),
      //createSelectionBetween:createSelectionBetween(this.editorsEditableObj,editorID),

    });
    EditorContainer.appendChild(container);
    //@ts-ignore
    editorView.globalMenusAndSchemasSectionsDefs = this.globalMenusAndSchemasSectionsDefs
    //@ts-ignore
    editorView.citableElementMenusAndSchemaDefs = citableElementMenusAndSchemaDefs
    //@ts-ignore
    editorView.sectionID = sectionID
    //@ts-ignore
    editorView.editorType = 'editorWithCustomSchema'
    //@ts-ignore
    editorView.isPopupEditor = true;
    let editorCont: any = {
      editorID: editorID,
      containerDiv: container,
      editorState: edState,
      editorView: editorView,
      dispatchTransaction: dispatchTransaction
    };
    if (options.autoFocus) {
      setTimeout(() => {
        (editorCont.editorView as EditorView).focus();
        (editorCont.editorView as EditorView).dispatch((editorCont.editorView as EditorView).state.tr)
      }, 200)
    }
    return editorCont
  }

  renderSeparatedEditorWithNoSync(EditorContainer: HTMLDivElement, menuContainerClass: string, startingText?: string|Node): editorContainer {

    let hideshowPluginKEey = this.trackChangesService.hideshowPluginKey;
    EditorContainer.innerHTML = ''
    let editorID = random.uuidv4()
    let container = document.createElement('div');
    let editorView: EditorView;
    let doc: Node;

    container.setAttribute('class', 'editor-container');

    let filterTransaction = false

    let transactionControllerPluginKey = new PluginKey('transactionControllerPlugin');

    /*fieldFormControl?.valueChanges.subscribe((data) => {

       let tr = recreateTransform(
        doc ,
        endDoc,
        complexSteps = true, // Whether step types other than ReplaceStep are allowed.
        wordDiffs = false // Whether diffs in text nodes should cover entire words.
      )
    })*/

    this.editorsEditableObj[editorID] = true

    let menu: any = { main: this.menuTypes['onlyPmMenu'] }

    if (startingText) {
      if(startingText instanceof Node){
        doc = schema.nodes.doc.create({}, startingText)
      }else{
        doc = schema.nodes.doc.create({}, schema.nodes.form_field.create({}, schema.nodes.paragraph.create({}, schema.text(startingText))))
      }
    } else {
      doc = schema.nodes.doc.create({}, schema.nodes.form_field.create({}, schema.nodes.paragraph.create({})))
    }
    let edState = EditorState.create({
      doc,
      schema: schema,
      plugins: [
        mathPlugin,
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': undo,
          'Mod-Space': insertMathCmd(schema.nodes.math_inline),
          'Backspace': chainCommands(deleteSelection, mathBackspaceCmd, joinBackward, selectNodeBackward),
          'Tab': goToNextCell(1),
          'Shift-Tab': goToNextCell(-1)
        }),
        columnResizing({}),
        tableEditing(),
        this.placeholderPluginService.getPlugin(),
        this.citationButtonsService.citationButtonsPlugin,
        // inputRules({ rules: [this.inlineMathInputRuleGlobal, this.blockMathInputRuleGlobal] }),
        ...menuBar({
          floating: true,
          clearYJSUndoRedo:true,
          undoRedoMenuItems:this.undoRedoMenuItems,
          content: menu , containerClass: menuContainerClass
        })
      ].concat(exampleSetup({ schema, /* menuContent: fullMenuWithLog, */ containerClass: menuContainerClass }))
      ,
      //@ts-ignore
      /*  editorType: 'popupEditor' */
    });
    setTimeout(() => {
      this.initDocumentReplace[editorID] = false;
    }, 600);

    this.editorsEditableObj[editorID] = true
    let lastStep: any
    let lastContainingInsertionMark: any
    const dispatchTransaction = (transaction: Transaction) => {
      this.transactionCount++
      try {
        if (lastStep == transaction.steps[0]) {
          if (lastStep) { return }
        }
        lastStep = transaction.steps[0]
        let isMath = false;
        if (transaction.selection instanceof NodeSelection && (transaction.selection.node.type.name == 'math_inline' || transaction.selection.node.type.name == 'math_display')) {
          let hasmarkAddRemoveStep = transaction.steps.filter((step) => {
            return (step instanceof AddMarkStep || step instanceof RemoveMarkStep)
          }).length > 0;
          if (hasmarkAddRemoveStep) {
            return
          }
          isMath = true
        }
        let state = editorView?.state.apply(transaction);
        editorView?.updateState(state!);

      } catch (err) { console.error(err); }
    };
    let mathMap = this.ydocService.mathMap
    editorView = new EditorView(container, {
      state: edState,
      handlePaste: handlePaste(this.serviceShare),
      transformPastedHTML: transformPastedHTML,
      clipboardTextSerializer: (slice: Slice) => {
        return mathSerializer.serializeSlice(slice);
      },
      editable: (state: EditorState) => {
        return !this.mobileVersion && this.editorsEditableObj[editorID]
        // mobileVersion is true when app is in mobile mod | editable() should return return false to set editor not editable so we return !mobileVersion
      },
      dispatchTransaction,

    });
    EditorContainer.appendChild(container);

    let editorCont: any = {
      editorID: editorID,
      containerDiv: container,
      editorState: edState,
      editorView: editorView,
      dispatchTransaction: dispatchTransaction
    };
    return editorCont
  }

  runFuncAfterRender() {
    this.serviceShare.YjsHistoryService.preventCaptureOfBigNumberOfUpcomingItems();

    // pass current users in article
    let updateArticleUserStates = () => {
      if(this.provider){
        let userStates =  this.provider!.awareness.getStates();
        this.serviceShare.ProsemirrorEditorsService.usersInArticleStatusSubject.next(userStates)
      }
    }
    this.provider!.awareness.on('update',(added:any[],updated:any[],removed:any[])=>{
      updateArticleUserStates()
    })

    updateArticleUserStates()
    setTimeout(() => {
      this.serviceShare.YjsHistoryService.stopBigNumberItemsCapturePrevention();
      this.stopSpinner()
    }, 20)
  }
  undoRedoMenuItems
  buildMenus() {
    this.undoRedoMenuItems = {
      yjsundo:this.yjsHistory.undoYjs(),
      yjsredo:this.yjsHistory.redoYjs(),
      pmundo:getItems().undoItemPM,
      pmredo:getItems().redoItemPM,
    }
    this.menuTypes = this.menuService.buildMenuTypes()
  }

  init() {
    let data = this.ydocService.getData();
    this.userInfo = data.userInfo
    this.ydoc = data.ydoc;
    this.provider = data.provider;
    this.articleSectionsStructure = data.articleSectionsStructure;
    let trackChangesMetadata = this.ydocService.trackChangesMetadata?.get('trackChangesMetadata');
    this.trackChangesMeta = trackChangesMetadata
    this.shouldTrackChanges = trackChangesMetadata.trackTransactions;
    this.ydocService.trackChangesMetadata?.observe((ymap) => {
      let trackChangesMetadata = this.ydocService.trackChangesMetadata?.get('trackChangesMetadata');
      if (trackChangesMetadata.lastUpdateFromUser !== this.ydoc?.guid) {
      }
      this.trackChangesMeta = trackChangesMetadata
      this.shouldTrackChanges = trackChangesMetadata.trackTransactions
    })

    this.permanentUserData = new Y.PermanentUserData(this.ydoc);
    this.permanentUserData.setUserMapping(this.ydoc, this.ydoc.clientID, this.user.username);
    this.ydoc.gc = false;
    this.buildMenus()
    let ydocservice = this.ydocService
    let seviceShare = this.serviceShare
    let mathObj = ydocservice.mathMap?.get('dataURLObj');
    //@ts-ignore
    if (!MathView.prototype.isPatched) {
      //@ts-ignore

      MathView.prototype.isPatched = true;
      let oldMathFunc = MathView.prototype.renderMath
      //@ts-ignore
      MathView.prototype.renderMath = undefined;
      //@ts-ignore
      MathView.prototype.renderMathOld = oldMathFunc;
      //@ts-ignore
      MathView.prototype.afterRender = (ret: any, mathview: any) => {
        /*  mathObj = ydocservice.mathMap?.get('dataURLObj');
         let matDom = (mathview.dom as HTMLElement).getElementsByClassName('katex-display')[0]||(mathview.dom as HTMLElement).getElementsByClassName('math-render')[0]||mathview.dom;
         */
        /* if(mathview&&mathview._node&&mathview._node.textContent){
          let div = document.createElement('div')
          katex.render(mathview._node.textContent,div,{output:'mathml'})
        } */

        let nodeDomAttrs = mathview._node.type.spec.toDOM(mathview._node)[1];
        Object.keys(nodeDomAttrs).forEach((key) => {
          ((mathview.dom as HTMLElement).hasAttribute(key) && nodeDomAttrs[key] !== '' && nodeDomAttrs[key]) ? undefined : (mathview.dom as HTMLElement).setAttribute(key, nodeDomAttrs[key]);
        });
      };
      MathView.prototype.renderMath = function renderMath() {
        //@ts-ignore
        let ret = this.renderMathOld()
        //@ts-ignore
        return this.afterRender(ret, this)
      }
    }
    //check if chould be scrolled to comment ;
    return new Observable((sub)=>{
      setTimeout(()=>{
        // editors should be rendered
        sub.next(true);
      },1000)
    })

  }

  setIntFunction(interpulateFunction: any) {
    this.interpolateTemplate = interpulateFunction
  }

  spinnerContainer?: HTMLDivElement
  setSpinner(spinnerContainer: HTMLDivElement) {
    this.spinnerContainer = spinnerContainer;
  }

  spinning = false;
  spinSpinner = () => {
    this.spinning = true;
    this.spinnerContainer.style.display = 'block'
  }
  stopSpinner = () => {
    this.spinning = false;
    this.spinnerContainer.style.display = 'none'
  }
}


