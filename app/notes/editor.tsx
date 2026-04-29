import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Keyboard,
  LayoutAnimation,
  Share,
  StatusBar,
  useWindowDimensions,
  Vibration,
  Modal,
  Pressable
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView, PinchGestureHandler } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Save, 
  Heading, 
  List, 
  Bold, 
  Italic, 
  Palette, 
  Check, 
  Trash2, 
  BookOpen, 
  ExternalLink,
  X,
  Layout,
  Highlighter,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit3,
  Tag,
  FileDown,
  FileText,
  Zap,
  Tag as TagIcon,
  Sparkles,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Settings,
  Type,
  Copy,
  Edit,
  Scissors
} from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { AddBlockToFlashcardSheet } from '../../src/components/AddBlockToFlashcardSheet';
import { useRecentNotes } from '../../src/hooks/useRecentNotes';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// STATIC CONSTANTS FOR STABILITY
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24
};

const HIGHLIGHT_COLORS = ['transparent', '#FF6A88', '#6A5BFF', '#4FC3F7', '#81C784', '#FFB74D', '#BA68C8'];

export default function NoteEditor() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const blockRefs = useRef<Record<string, any>>({});
  const lastTapInfo = useRef({ index: -1, time: 0 });

  const handleBlockPress = (idx: number, item: any, onSingleTap?: () => void) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 400;
    if (lastTapInfo.current.index === idx && now - lastTapInfo.current.time < DOUBLE_TAP_DELAY) {
      // Double Tap detected
      setViewMode('edit');
      const itemId = item.id || `item-${idx}`;
      setActiveInput({ type: 'highlight', id: item.id });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Auto-focus after a short delay to allow mode switch
      setTimeout(() => {
        if (blockRefs.current[itemId]) {
          blockRefs.current[itemId].focus();
        }
      }, 100);
    } else {
      // Single Tap
      if (onSingleTap) onSingleTap();
    }
    lastTapInfo.current = { index: idx, time: now };
  };
  
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState((Array.isArray(params.title) ? params.title[0] : params.title) || "");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState((Array.isArray(params.subject) ? params.subject[0] : params.subject) || "General");
  const [folderName, setFolderName] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<{id: string, text: string, checked: boolean}[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [expandedSubheadings, setExpandedSubheadings] = useState<Set<string>>(new Set());
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);
  const [nextRevision, setNextRevision] = useState<string | null>(null);
  const [isExportMenuVisible, setIsExportMenuVisible] = useState(false);
  const [activeBlockAction, setActiveBlockAction] = useState<{ id: string, text: string, type: string, index: number } | null>(null);
  const [insertPointData, setInsertPointData] = useState<{ index: number, visible: boolean, text: string }>({ index: -1, visible: false, text: '' });
  const [insertSelection, setInsertSelection] = useState({ start: 0, end: 0 });
  const insertInputRef = useRef<TextInput>(null);

  const onBlockLongPress = (item: any, index: number) => {
    Vibration.vibrate(50);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveBlockAction({ ...item, index });
  };

  const handleCopyBlock = async () => {
    if (!activeBlockAction) return;
    await Share.share({ message: activeBlockAction.text });
    setActiveBlockAction(null);
  };

  const handleDeleteBlock = () => {
    if (!activeBlockAction) return;
    const next = items.filter((_, i) => i !== activeBlockAction.index);
    setItems(next);
    setActiveBlockAction(null);
  };

  const handleInsertPoint = (idx: number) => {
    setInsertPointData({ index: idx, visible: true, text: '' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const commitInsertion = () => {
    if (!insertPointData.text.trim()) {
      setInsertPointData({ ...insertPointData, visible: false });
      return;
    }
    
    const newPoint = {
      id: `new-${Date.now()}`,
      type: 'highlight',
      text: insertPointData.text.trim(),
      color: HIGHLIGHT_COLORS[0]
    };
    
    const next = [...items];
    next.splice(insertPointData.index, 0, newPoint);
    setItems(next);
    setInsertPointData({ ...insertPointData, visible: false, text: '' });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const [editorFontSize, setEditorFontSize] = useState(14);
  const baseFontSize = useRef(14);

  // Load saved font size on mount
  useEffect(() => {
    const loadFontSize = async () => {
      try {
        const saved = await AsyncStorage.getItem('notes_editor_font_size');
        if (saved) {
          const size = parseInt(saved, 10);
          setEditorFontSize(size);
          baseFontSize.current = size;
        }
      } catch (e) { console.error(e); }
    };
    loadFontSize();
  }, []);

  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimer = useRef<any>(null);

  const onPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    let nextSize = baseFontSize.current * scale;
    nextSize = Math.max(10, Math.min(32, nextSize));
    setEditorFontSize(Math.round(nextSize));
    
    setShowZoomIndicator(true);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setShowZoomIndicator(false), 1500);
  };

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === 4) { // 4 is ACTIVE/END
      baseFontSize.current = editorFontSize;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Save to local storage
      AsyncStorage.setItem('notes_editor_font_size', editorFontSize.toString()).catch(console.error);
    }
  };

  const [isPreviewColumns, setIsPreviewColumns] = useState<number>(1);
  const [lastRevised, setLastRevised] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<{type: 'main' | 'highlight' | 'checklist', id?: string}>({ type: 'main' });
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [tags, setTags] = useState<string[]>([]);
  const [flashSheet, setFlashSheet] = useState<{ visible: boolean; text: string; blockId?: string }>({ visible: false, text: '' });
  const { addRecent } = useRecentNotes();
  
  // ZEN MODE & PDF CONFIG STATE
  const [isZenMode, setIsZenMode] = useState(false);
  const [pdfFontSize, setPdfFontSize] = useState(14);
  const [pdfSubheadingColor, setPdfSubheadingColor] = useState('#f3f4f6');
  const [exportSubheadings, setExportSubheadings] = useState<Set<string>>(new Set());
  const [showAdvancedPDF, setShowAdvancedPDF] = useState(false);
  
  // Advanced PDF Settings
  const [pdfPaperStyle, setPdfPaperStyle] = useState<'plain' | 'lined' | 'grid' | 'dots'>('plain');
  const [pdfTheme, setPdfTheme] = useState<'modern' | 'sepia' | 'historical'>('modern');
  const [pdfWatermark, setPdfWatermark] = useState('');
  const [pdfFooterText, setPdfFooterText] = useState('UPSC Repository');
  const [pdfShowTOC, setPdfShowTOC] = useState(false);
  const [pdfIncludeChecklist, setPdfIncludeChecklist] = useState(true);
  const [pdfSpacing, setPdfSpacing] = useState<'compact' | 'comfortable'>('comfortable');
  const [pdfFontFamily, setPdfFontFamily] = useState<'sans' | 'handwriting'>('sans');

   const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
   const zenAnim = useRef(new Animated.Value(0)).current;

   useEffect(() => {
     const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
     const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
     return () => {
       showSub.remove();
       hideSub.remove();
     };
   }, []);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (id) {
      setViewMode('preview');
      fetchNote();
    } else {
      setViewMode('edit');
      setLoading(false);
    }
  }, [id]);

  const fetchNote = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('user_notes').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        setTitle(data.title || "");
        setSubject(data.subject || "General");
        setContent(data.content || ""); 
        
        if (data.updated_at) {
          const date = new Date(data.updated_at);
          setLastRevised(date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        
        const checkData = data.checklist_notes;
        if (Array.isArray(checkData)) {
          setChecklist(checkData);
        } else if (typeof checkData === 'string' && checkData.startsWith('[')) {
          try { setChecklist(JSON.parse(checkData)); } catch { setChecklist([]); }
        }
        
        if (Array.isArray(data.items)) {
          setItems(data.items);
        } else if (Array.isArray(data.highlights)) {
          setItems(data.highlights);
        }

        const { data: nodeData } = await supabase.from('user_note_nodes').select('parent_id').eq('note_id', id).single();
        if (nodeData?.parent_id) {
           const { data: parentData } = await supabase.from('user_note_nodes').select('title').eq('id', nodeData.parent_id).single();
           if (parentData) setFolderName(parentData.title);
        }

        // Track as recent
        addRecent({ id, title: data.title || 'Untitled', subject: data.subject || 'General' });
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not load note content.");
    } finally {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLoading(false);
    }
  };

  const handleSave = async (isAuto = false) => {
    if (!id || !session?.user?.id) return;
    if (!isAuto) setSaving(true);
    
    try {
      const updateData = {
        title,
        content,
        subject,
        items,
        checklist_notes: JSON.stringify(checklist),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase.from('user_notes').update(updateData).eq('id', id);
      if (error) throw error;
      
      await supabase.from('user_note_nodes').update({ title, updated_at: new Date().toISOString() }).eq('note_id', id);
      
    } catch (err) {
      console.error(err);
      if (!isAuto) Alert.alert("Error", "Could not save note.");
    } finally {
      if (!isAuto) setSaving(false);
    }
  };

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => handleSave(true), 3000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [title, content, items, checklist]);

  const toggleZenMode = () => {
    if (!isZenMode) {
      setIsZenMode(true);
      Animated.timing(zenAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
    } else {
      Animated.timing(zenAnim, { toValue: 0, duration: 400, useNativeDriver: false }).start(() => setIsZenMode(false));
    }
  };

  const applyFormat = (type: string) => {
    if (activeInput.type === 'main') {
      const before = content.substring(0, selection.start);
      const target = content.substring(selection.start, selection.end);
      const after = content.substring(selection.end);
      let newText = "";
      if (type === 'bold') newText = `${before}**${target}**${after}`;
      else if (type === 'italic') newText = `${before}_${target}_${after}`;
      else if (type === 'bullet') newText = `${before}\n• ${target}${after}`;
      else if (type === 'heading') newText = `${before}\n# ${target}${after}`;
      if (newText) setContent(newText);
    } else if (activeInput.type === 'highlight' && activeInput.id) {
       setItems(items.map(item => {
          if (item.id === activeInput.id) {
             let txt = item.text;
             if (type === 'bold') txt = `**${txt}**`;
             else if (type === 'italic') txt = `_${txt}_`;
             return { ...item, text: txt };
          }
          return item;
       }));
    }
  };

  const insertPoint = (type: 'bullet' | 'check' | 'num' | 'idea' | 'indent') => {
    if (activeInput.type !== 'main') return;
    
    Vibration.vibrate(10);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const before = content.substring(0, selection.start);
    const after = content.substring(selection.end);
    let insertion = "";

    switch(type) {
      case 'bullet': insertion = "\n• "; break;
      case 'check': insertion = "\n- [ ] "; break;
      case 'num': insertion = "\n1. "; break;
      case 'idea': insertion = "\n> 💡 **Key Point:** "; break;
      case 'indent': insertion = "  "; break;
    }

    setContent(before + insertion + after);
    // Move selection to end of insertion
    setSelection({ 
      start: selection.start + insertion.length, 
      end: selection.start + insertion.length 
    });
  };

  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === 'Enter') {
      const lineStart = content.lastIndexOf('\n', selection.start - 1) + 1;
      const currentLine = content.substring(lineStart, selection.start);
      
      let autoPrefix = "";
      if (currentLine.trim().startsWith('•')) autoPrefix = "• ";
      else if (currentLine.trim().startsWith('- [ ]')) autoPrefix = "- [ ] ";
      else if (currentLine.trim().startsWith('- [x]')) autoPrefix = "- [ ] ";
      else if (currentLine.match(/^\d+\./)) {
        const num = parseInt(currentLine.match(/^\d+/)![0]);
        autoPrefix = `${num + 1}. `;
      }

      if (autoPrefix) {
        if (currentLine.trim() === '•' || currentLine.trim() === '- [ ]' || currentLine.match(/^\d+\. $/)) {
          // Double enter to exit
          const newContent = content.substring(0, lineStart) + content.substring(selection.start);
          setContent(newContent);
          setSelection({ start: lineStart, end: lineStart });
          return;
        }
        
        // Auto-continue
        const before = content.substring(0, selection.start);
        const after = content.substring(selection.end);
        setContent(before + "\n" + autoPrefix + after);
        const newPos = selection.start + autoPrefix.length + 1;
        setSelection({ start: newPos, end: newPos });
        // Prevent default enter
        return true; 
      }
    }
  };

  const addItem = (type: 'highlight' | 'microTopicHeading') => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      text: "",
      color: type === 'highlight' ? colors.primary : undefined
    };
    const next = [...items, newItem];
    setItems(next);
    if (type === 'microTopicHeading') {
       const nextSet = new Set(expandedSubheadings);
       nextSet.add(newItem.id);
       setExpandedSubheadings(nextSet);
    }
  };

  const toggleSubheading = (itemId: string) => {
    const nextSet = new Set(expandedSubheadings);
    if (nextSet.has(itemId)) {
      nextSet.delete(itemId);
      setExpandedSubheadings(nextSet);
    } else {
      nextSet.add(itemId);
      setExpandedSubheadings(nextSet);
    }
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, { id: Date.now().toString(), text: newChecklistItem, checked: false }]);
    setNewChecklistItem("");
  };

  const toggleChecklistItem = (itemId: string) => {
    setChecklist(checklist.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item));
  };

  const removeChecklistItem = (itemId: string) => {
    setChecklist(checklist.filter(item => item.id !== itemId));
  };

  const handleExportPDF = async (cols: number) => {
    if (saving) return;
    setIsExportMenuVisible(false);
    setSaving(true);
    
    try {
      const parseMD = (txt: string) => {
        if (!txt) return '';
        return txt
          .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
          .replace(/_(.*?)_/g, '<i>$1</i>')
          .replace(/^\s*[\-\*]\s+(.*)/gm, '• $1')
          .replace(/\n/g, '<br/>');
      };

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap" rel="stylesheet">
            <style>
              @page { margin: 10mm 5mm; }
              body { 
                font-family: ${pdfFontFamily === 'handwriting' ? "'Caveat', cursive" : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'};
                padding: 0; 
                margin: 0;
                color: ${pdfTheme === 'sepia' ? '#433422' : pdfTheme === 'historical' ? '#2d2419' : '#374151'};
                font-size: ${pdfFontSize}px;
                line-height: 1.5;
                background-color: ${pdfTheme === 'sepia' ? '#F4ECD8' : pdfTheme === 'historical' ? '#fdf6e3' : '#ffffff'};
                background-image: ${
                  pdfPaperStyle === 'lined' ? 'linear-gradient(#e5e7eb 1px, transparent 1px)' :
                  pdfPaperStyle === 'grid' ? 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)' :
                  pdfPaperStyle === 'dots' ? 'radial-gradient(#e5e7eb 1px, transparent 1px)' : 'none'
                };
                background-size: ${
                  pdfPaperStyle === 'lined' ? '100% 24px' :
                  pdfPaperStyle === 'grid' ? '24px 24px' :
                  pdfPaperStyle === 'dots' ? '24px 24px' : 'auto'
                };
              }
              .subject-badge {
                color: #6366f1;
                font-weight: 800;
                font-size: 0.8em;
                letter-spacing: 1px;
                text-transform: uppercase;
                margin-bottom: 8px;
              }
              h1 { 
                font-size: 2.2em; 
                font-weight: 900;
                margin: 0 0 20px 0; 
                color: #111827; 
                letter-spacing: -1px;
              }
              .section-label {
                font-size: 0.7em;
                font-weight: 800;
                color: #9ca3af;
                letter-spacing: 2px;
                text-transform: uppercase;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 8px;
                margin: 30px 0 20px 0;
              }
              .main-content {
                margin-bottom: ${pdfSpacing === 'compact' ? '15px' : '30px'};
                color: inherit;
              }
              .highlights-grid {
                display: ${cols === 2 ? 'grid' : 'block'};
                ${cols === 2 ? 'grid-template-columns: 1fr 1fr; grid-gap: 20px;' : ''}
                width: 100%;
              }
              .highlight-card {
                break-inside: avoid;
                page-break-inside: avoid;
                margin-bottom: ${pdfSpacing === 'compact' ? '8px' : '15px'};
                padding: ${pdfSpacing === 'compact' ? '8px 12px' : '12px 16px'};
                background: ${pdfTheme === 'modern' ? '#fff' : 'rgba(255,255,255,0.4)'};
                border: 1px solid ${pdfTheme === 'modern' ? '#f3f4f6' : 'rgba(0,0,0,0.05)'};
                border-left: 4px solid #6366f1;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.02);
              }
              .highlight-text {
                margin-bottom: 8px;
                color: #1f2937;
                display: flex;
                gap: 10px;
              }
              .bullet {
                font-size: 0.8em;
                line-height: 1.8;
              }
              .highlight-source {
                font-size: 0.65em;
                font-weight: 700;
                color: #6366f1;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .group-heading {
                break-after: avoid;
                ${cols === 2 ? 'grid-column: 1 / -1;' : ''}
                font-weight: 900;
                font-size: 1.1em;
                color: inherit;
                margin: ${pdfSpacing === 'compact' ? '15px 0 8px 0' : '30px 0 15px 0'};
                padding: 8px 16px;
                background: ${pdfSubheadingColor};
                border-radius: 12px;
                display: block;
                text-transform: uppercase;
              }
              .watermark {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-45deg);
                font-size: 80px;
                font-weight: 900;
                color: rgba(0,0,0,0.03);
                white-space: nowrap;
                pointer-events: none;
                z-index: -1;
              }
              .footer {
                position: fixed;
                bottom: -10mm;
                left: 0;
                right: 0;
                font-size: 10px;
                color: #9ca3af;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .toc-container {
                margin-bottom: 40px;
                padding: 20px;
                background: rgba(0,0,0,0.02);
                border-radius: 12px;
              }
              .toc-title { font-weight: 900; font-size: 14px; margin-bottom: 12px; color: inherit; }
              .toc-item { display: block; font-size: 12px; color: inherit; text-decoration: none; margin-bottom: 6px; border-bottom: 1px dashed rgba(0,0,0,0.1); }
              .checklist-pdf { margin-top: 40px; }
              .checklist-item-pdf { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; }
              .checkbox-pdf { width: 14px; height: 14px; border: 1px solid #9ca3af; border-radius: 3px; }
              .checkbox-pdf.checked { background: #6366f1; border-color: #6366f1; }
              * { -webkit-print-color-adjust: exact; box-sizing: border-box; }
            </style>
          </head>
          <body>
            ${pdfWatermark ? `<div class="watermark">${pdfWatermark}</div>` : ''}
            <div class="footer">${pdfFooterText} • ${new Date().toLocaleDateString()}</div>
            
            <div class="subject-badge">${subject || 'General'}</div>
            <h1>${title || 'Untitled Note'}</h1>
            
            ${pdfShowTOC ? `
              <div class="toc-container">
                <div class="toc-title">Table of Contents</div>
                ${items
                  .filter(i => i.type === 'microTopicHeading' && exportSubheadings.has(i.id))
                  .map(i => `<div class="toc-item">${i.text}</div>`)
                  .join('')}
              </div>
            ` : ''}

            <div class="main-content">
              ${parseMD(content)}
            </div>

            <div class="section-label">Practice Highlights</div>
            
            <div class="highlights-grid">
              ${(() => {
                let currentSubheadingId = '';
                let isExporting = true;
                const filteredItems = items.filter(item => {
                  if (item.type === 'microTopicHeading') {
                    currentSubheadingId = item.id;
                    isExporting = exportSubheadings.has(item.id);
                    return isExporting;
                  }
                  return isExporting;
                });

                return filteredItems.map(item => {
                  if (item.type === 'microTopicHeading') {
                    return `<div class="group-heading">${item.text}</div>`;
                  }
                  const cardColor = item.color || '#6366f1';
                  return `
                    <div class="highlight-card" style="border-left-color: ${cardColor}">
                      <div class="highlight-text">
                        <span class="bullet" style="color: ${cardColor}">●</span>
                        <div>${parseMD(item.text)}</div>
                      </div>
                      <div class="highlight-source">Source: ${subject} • Q#${items.indexOf(item) + 1}</div>
                    </div>
                  `;
                }).join('');
              })()}
            </div>

            ${pdfIncludeChecklist && checklist.length > 0 ? `
              <div class="checklist-pdf">
                <div class="section-label">Checklist / Tasks</div>
                ${checklist.map(c => `
                  <div class="checklist-item-pdf">
                    <div class="checkbox-pdf ${c.checked ? 'checked' : ''}"></div>
                    <div style="${c.checked ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${c.text}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </body>
        </html>
      `;
      
      // Use Print.printAsync for native printer dialog (includes preview)
      if (Platform.OS === 'ios') {
        // On iOS, printToFileAsync followed by Sharing is more reliable for columns and CSS
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTIType: 'com.adobe.pdf', mimeType: 'application/pdf' });
      } else {
        await Print.printAsync({ html });
      }
      
    } catch (err) {
      console.error(err);
      Alert.alert("Export Error", "Could not generate PDF.");
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewPDF = () => {
    // Sync export subheadings with all available ones before opening menu if set is empty
    if (exportSubheadings.size === 0) {
      const allHeads = items.filter(i => i.type === 'microTopicHeading').map(i => i.id);
      setExportSubheadings(new Set(allHeads));
    }
    setIsExportMenuVisible(true);
  };
  const renderHighlights = (allowAdd: boolean) => {
    let isCurrentExpanded = true; 
    const currentItems = items || [];
    const isActuallyEditing = viewMode === 'edit';
    const isTwoCol = isPreviewColumns === 2 && viewMode === 'preview';

    const renderInsertPlus = (insertIdx: number) => {
      if (!isActuallyEditing) return null;
      return (
        <View style={styles.insertPlusContainer}>
          <View style={[styles.insertPlusLine, { backgroundColor: colors.border }]} />
          <TouchableOpacity 
            onPress={() => handleInsertPoint(insertIdx)}
            style={[styles.insertPlusBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Plus size={14} color={colors.primary} />
          </TouchableOpacity>
          <View style={[styles.insertPlusLine, { backgroundColor: colors.border }]} />
        </View>
      );
    };

    return (
      <View style={styles.highlightsContainer}>
        <View style={styles.highlightsHeaderRow}>
          <Text style={[styles.highlightsHeader, { color: colors.textTertiary }]}>PRACTICE HIGHLIGHTS</Text>
          {allowAdd && isActuallyEditing && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => addItem('microTopicHeading')} style={styles.miniAddBtn}>
                <Plus size={12} color={colors.primary} /><Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>HEADING</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => addItem('highlight')} style={styles.miniAddBtn}>
                <Plus size={12} color={colors.primary} /><Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>POINT</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={isTwoCol ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : {}}>
          {currentItems.map((item, idx) => {
            if (item.type === 'microTopicHeading') {
              const itemId = item.id || `head-${idx}`;
              isCurrentExpanded = expandedSubheadings.has(itemId);
              return (
                <TouchableOpacity 
                  key={itemId} 
                  activeOpacity={0.7}
                  onPress={() => handleBlockPress(idx, item, () => toggleSubheading(itemId))}
                  onLongPress={() => onBlockLongPress(item, idx)}

                  style={[styles.headingRow, isTwoCol && { width: '100%' }]}
                >
                  <View style={{ paddingRight: 10 }}>
                     {isCurrentExpanded ? <ChevronDown size={14} color={colors.primary} /> : <ChevronRight size={14} color={colors.textTertiary} />}
                  </View>
                  {isActuallyEditing ? (
                    <TextInput 
                      ref={el => blockRefs.current[itemId] = el}
                      style={[styles.groupHeading, { color: colors.textPrimary, flex: 1, fontSize: editorFontSize + 2 }]} 
                      value={item.text} 
                      onChangeText={(t) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], text: t };
                        setItems(next);
                      }}
                      placeholder="HEADING NAME"
                      onPressIn={(e) => e.stopPropagation && e.stopPropagation()}
                    />
                  ) : (
                    <Text style={[styles.groupHeading, { color: colors.textPrimary, flex: 1, fontSize: editorFontSize + 2 }]}>{item.text.toUpperCase()}</Text>
                  )}
                </TouchableOpacity>
              );
            }
            if (!isCurrentExpanded) return null;
            return (
              <React.Fragment key={item.id || `frag-${idx}`}>
                {renderInsertPlus(idx)}
                <Pressable 
                  style={[{ marginBottom: 12 }, isTwoCol && { width: (width - 48 - 12) / 2 }]}
                  onPress={() => handleBlockPress(idx, item)}
                  onLongPress={() => onBlockLongPress(item, idx)}
                >
                <LinearGradient
                  colors={isActuallyEditing ? [colors.surface, colors.surface] : [(item.color || colors.primary) + '20', colors.surface]}
                  style={[styles.highlightCard, { borderColor: isActuallyEditing ? colors.border : (item.color || colors.primary) + '40', borderLeftColor: item.color || colors.primary, borderLeftWidth: 4 }]}
                >
                  {isActuallyEditing ? (
                    <TextInput 
                      ref={el => blockRefs.current[item.id || `item-${idx}`] = el}
                      style={[styles.highlightText, { color: colors.textPrimary, fontSize: editorFontSize }]} 
                      value={item.text} 
                      onChangeText={(t) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], text: t };
                        setItems(next);
                      }}
                      multiline
                      onFocus={() => setActiveInput({ type: 'highlight', id: item.id })}
                    />
                  ) : (
                    <Text style={[styles.highlightText, { color: colors.textPrimary, fontSize: editorFontSize }]}>{item.text}</Text>
                  )}
                  {isActuallyEditing && (
                    <View style={styles.highlightActions}>
                      <TouchableOpacity onPress={() => setShowColorPicker(showColorPicker === idx ? null : idx)}>
                        <Palette size={14} color={colors.textTertiary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setItems(items.filter((_, i) => i !== idx))}>
                        <Trash2 size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </LinearGradient>
                
                {isActuallyEditing && showColorPicker === idx && (
                  <View style={styles.popoverPicker}>
                    {HIGHLIGHT_COLORS.map(c => (
                      <TouchableOpacity 
                        key={c} 
                        style={[
                          styles.colorBubble, 
                          { 
                            backgroundColor: c === 'transparent' ? colors.surface : c,
                            borderWidth: c === 'transparent' ? 1 : 0,
                            borderColor: colors.border,
                            alignItems: 'center',
                            justifyContent: 'center'
                          }
                        ]} 
                        onPress={() => {
                          const next = [...items];
                          next[idx] = { ...next[idx], color: c === 'transparent' ? undefined : c };
                          setItems(next);
                          setShowColorPicker(null);
                        }}
                      >
                        {c === 'transparent' && <X size={12} color={colors.textTertiary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Pressable>
              {idx === currentItems.length - 1 && renderInsertPlus(currentItems.length)}
            </React.Fragment>
          );
        })}
      </View>
      </View>
    );
  };

  const zenPadding = zenAnim.interpolate({ inputRange: [0, 1], outputRange: [SPACING.lg, SPACING.xxl] });
  const zenScale = zenAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  
  // BOOKISH TINGE FOR ZEN MODE
  const zenBg = isZenMode ? '#F4ECD8' : colors.bg; 
  const zenTextColor = isZenMode ? '#433422' : colors.textPrimary;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PageWrapper>
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchHandlerStateChange}
        >
          <View style={[styles.container, { backgroundColor: zenBg }]}>
            <StatusBar hidden={isZenMode} barStyle={isZenMode ? 'dark-content' : 'default'} />
        
        {/* HEADER - HIDES IN ZEN MODE */}
        {!isZenMode && (
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}><ArrowLeft size={24} color={colors.textPrimary} /></TouchableOpacity>
            <View style={styles.headerCenter}>
              <View style={styles.metaRow}>
                  <Text style={[styles.headerSub, { color: colors.primary }]}>{subject || 'General'}</Text>
                  {nextRevision && <View style={[styles.revBadge, { backgroundColor: colors.primary + '20' }]}><Text style={[styles.revText, { color: colors.primary }]}>REVISE</Text></View>}
              </View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title || 'Untitled Note'}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={toggleZenMode} style={styles.headerIcon}>
                 <Sparkles size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')} style={styles.headerIcon}>
                 {viewMode === 'edit' ? <BookOpen size={22} color={colors.textSecondary} /> : <Edit3 size={22} color={colors.textSecondary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSave(false)} style={styles.saveBtn}>
                {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Save size={22} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsExportMenuVisible(true)} style={styles.headerIcon}>
                 <FileDown size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {isZenMode && (
              <TouchableOpacity 
                style={styles.floatingZenExit} 
                onPress={toggleZenMode}
                activeOpacity={0.7}
              >
                <Minimize2 size={24} color="#433422" />
              </TouchableOpacity>
            )}
            {loading && !isZenMode && (
              <View style={{ position: 'absolute', top: 20, left: 0, right: 0, zIndex: 10, alignItems: 'center', pointerEvents: 'none' }}>
                <View style={{ backgroundColor: colors.surface + 'CC', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700' }}>SYNCING...</Text>
                </View>
              </View>
            )}
            
            {showZoomIndicator && (
              <View style={{ position: 'absolute', top: 100, alignSelf: 'center', zIndex: 100 }}>
                <View style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{editorFontSize}px</Text>
                </View>
              </View>
            )}
            
            <Animated.ScrollView 
              ref={scrollRef} 
              contentContainerStyle={[styles.scrollContent, { padding: zenPadding }]}
              showsVerticalScrollIndicator={!isZenMode}
            >
              <Animated.View style={{ transform: [{ scale: zenScale }] }}>
                {isZenMode ? (
                  <View style={styles.zenContainer}>
                     <View style={styles.zenHeader}>
                        <Text style={[styles.zenTitle, { color: zenTextColor }]}>{title}</Text>
                        <View style={[styles.zenDivider, { backgroundColor: '#43342240' }]} />
                     </View>
                     <Text style={[styles.zenBody, { color: zenTextColor, lineHeight: 32 }]}>{content}</Text>
                     {renderHighlights(false)}
                     <TouchableOpacity style={[styles.zenExitBtn, { backgroundColor: 'rgba(0,0,0,0.05)' }]} onPress={toggleZenMode}>
                        <Minimize2 size={24} color="#433422" />
                        <Text style={{ color: '#433422', fontWeight: '700', marginLeft: 8 }}>EXIT FOCUS</Text>
                     </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {viewMode === 'edit' ? (
                      <View>
                        <TextInput style={[styles.titleInput, { color: colors.textPrimary }]} placeholder="Note Title" value={title} onChangeText={setTitle} multiline />
                        
                        <View style={styles.checklistSection}>
                           <View style={[styles.checklistInputRow, { borderColor: colors.border }]}>
                              <TextInput style={[styles.checklistInput, { color: colors.textPrimary }]} placeholder="Add task..." value={newChecklistItem} onChangeText={setNewChecklistItem} onSubmitEditing={addChecklistItem} />
                              <TouchableOpacity onPress={addChecklistItem} style={[styles.addCheckBtn, { backgroundColor: colors.primary }]}><Plus size={18} color="#fff" /></TouchableOpacity>
                           </View>
                           {checklist.map(item => (
                             <View key={item.id} style={styles.checkItem}>
                                <TouchableOpacity onPress={() => toggleChecklistItem(item.id)} style={[styles.checkbox, { borderColor: item.checked ? colors.primary : colors.textTertiary }, item.checked && { backgroundColor: colors.primary }]}>{item.checked && <Check size={12} color="#fff" strokeWidth={4} />}</TouchableOpacity>
                                <TextInput style={[styles.checkText, { color: item.checked ? colors.textTertiary : colors.textPrimary }]} value={item.text} onChangeText={(txt) => setChecklist(checklist.map(c => c.id === item.id ? { ...c, text: txt } : c))} />
                                <TouchableOpacity onPress={() => removeChecklistItem(item.id)}><X size={16} color={colors.textTertiary} /></TouchableOpacity>
                             </View>
                           ))}
                        </View>

                        {renderHighlights(true)}

                        <TextInput 
                          style={[styles.mainEditor, { color: colors.textPrimary, fontSize: editorFontSize + 2 }]} 
                          placeholder="Start writing..." 
                          multiline 
                          value={content} 
                          onChangeText={setContent} 
                          onFocus={() => setActiveInput({ type: 'main' })} 
                          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                          onKeyPress={handleKeyPress}
                        />
                      </View>
                    ) : (
                      <View>
                        <LinearGradient colors={[colors.primary + '15', colors.surface, colors.surface]} style={styles.heroHeader}>
                          <View style={[styles.heroIconBox, { backgroundColor: colors.primary + '25' }]}><FileText size={24} color={colors.primary} /></View>
                          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{title || 'Untitled Note'}</Text>
                          {lastRevised && <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Last revised: {lastRevised}</Text>}
                        </LinearGradient>
                        {content ? <Text style={[styles.mainEditor, { color: colors.textPrimary, marginBottom: 24, fontSize: editorFontSize + 2 }]}>{content}</Text> : null}
                        {checklist.length > 0 && (
                          <View style={styles.checklistSection}>
                            <Text style={[styles.highlightsHeader, { color: colors.textTertiary }]}>CHECKLIST</Text>
                            {checklist.map(item => (
                              <View key={item.id} style={styles.checkItem}>
                                <View style={[styles.checkbox, { borderColor: item.checked ? colors.primary : colors.textTertiary }, item.checked && { backgroundColor: colors.primary }]}>{item.checked && <Check size={12} color="#fff" strokeWidth={4} />}</View>
                                <Text style={[styles.checkText, { color: item.checked ? colors.textTertiary : colors.textPrimary, textDecorationLine: item.checked ? 'line-through' : 'none' }]}>{item.text}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {renderHighlights(true)}
                      </View>
                    )}
                  </>
                )}
              </Animated.View>
            </Animated.ScrollView>
          </View>
        </KeyboardAvoidingView>

        {!isZenMode && viewMode === 'edit' && (
          <View style={[styles.bottomBarContainer, { bottom: isKeyboardVisible ? 0 : 20 }]}>
            {isKeyboardVisible && activeInput.type === 'main' && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={[styles.speedPointBar, { backgroundColor: colors.surface + 'F0', borderTopColor: colors.border }]}
                contentContainerStyle={styles.speedPointContent}
              >
                <TouchableOpacity style={styles.speedBtn} onPress={() => insertPoint('bullet')}>
                  <List size={18} color={colors.primary} />
                  <Text style={[styles.speedBtnText, { color: colors.textPrimary }]}>Point</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.speedBtn} onPress={() => insertPoint('check')}>
                  <Check size={18} color="#10b981" />
                  <Text style={[styles.speedBtnText, { color: colors.textPrimary }]}>Task</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.speedBtn} onPress={() => insertPoint('num')}>
                  <Text style={{ fontWeight: '900', color: colors.primary, fontSize: 16 }}>1.</Text>
                  <Text style={[styles.speedBtnText, { color: colors.textPrimary }]}>List</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.speedBtn} onPress={() => insertPoint('idea')}>
                  <Sparkles size={18} color="#f59e0b" />
                  <Text style={[styles.speedBtnText, { color: colors.textPrimary }]}>Key</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.speedBtn} onPress={() => insertPoint('indent')}>
                  <ChevronRight size={18} color={colors.textTertiary} />
                  <Text style={[styles.speedBtnText, { color: colors.textPrimary }]}>Tab</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            <View style={[styles.floatingBar, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: isKeyboardVisible ? 0 : 0 }]}>
               <TouchableOpacity style={styles.barItem} onPress={() => applyFormat('heading')}><Heading size={20} color={colors.textSecondary} /></TouchableOpacity>
               <TouchableOpacity style={styles.barItem} onPress={() => applyFormat('bold')}><Bold size={20} color={colors.textSecondary} /></TouchableOpacity>
               <TouchableOpacity style={styles.barItem} onPress={() => applyFormat('italic')}><Italic size={20} color={colors.textSecondary} /></TouchableOpacity>
               <TouchableOpacity style={styles.barItem} onPress={() => applyFormat('bullet')}><List size={20} color={colors.textSecondary} /></TouchableOpacity>
               <View style={styles.barDivider} />
               <TouchableOpacity style={styles.barItem} onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsPreviewColumns(isPreviewColumns === 1 ? 2 : 1);
               }}>
                  <Layout size={20} color={isPreviewColumns === 2 ? colors.primary : colors.textSecondary} />
               </TouchableOpacity>
            </View>
          </View>
        )}

        {!isZenMode && isExportMenuVisible && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 999 }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsExportMenuVisible(false)} />
            <View style={[styles.exportMenu, { backgroundColor: colors.surface, maxHeight: '90%' }]}>
              <View style={styles.sheetHandle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.exportTitle, { color: colors.textPrimary }]}>Export Customizer</Text>
                
                <View style={styles.exportSection}>
                  <Text style={[styles.exportSubHeader, { color: colors.textTertiary }]}>1. FONT SIZE & MARGINS</Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 8 }}>Fixed: 0.5cm Side • 1cm Top/Bottom</Text>
                  <View style={styles.fontSizeRow}>
                    {[12, 14, 16, 18, 20].map(sz => (
                      <TouchableOpacity 
                        key={sz} 
                        onPress={() => setPdfFontSize(sz)}
                        style={[styles.sizeBtn, { backgroundColor: pdfFontSize === sz ? colors.primary : colors.surfaceStrong }]}
                      >
                        <Text style={[styles.sizeBtnText, { color: pdfFontSize === sz ? '#fff' : colors.textPrimary }]}>{sz}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.exportSection}>
                  <Text style={[styles.exportSubHeader, { color: colors.textTertiary }]}>2. SUBHEADING HIGHLIGHT COLOR</Text>
                  <View style={styles.fontSizeRow}>
                    {['#f3f4f6', '#FF6A8820', '#6A5BFF20', '#4FC3F720', '#81C78420', '#FFB74D20'].map(c => (
                      <TouchableOpacity 
                        key={c} 
                        onPress={() => setPdfSubheadingColor(c)}
                        style={[styles.colorOption, { backgroundColor: c === '#f3f4f6' ? '#e5e7eb' : c, borderColor: pdfSubheadingColor === c ? colors.primary : 'transparent', borderWidth: 2 }]}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.exportSection}>
                  <Text style={[styles.exportSubHeader, { color: colors.textTertiary }]}>3. SELECT SUBHEADINGS TO EXPORT</Text>
                  <View style={styles.subheadingSelectArea}>
                    {items.filter(i => i.type === 'microTopicHeading').map(item => (
                      <TouchableOpacity 
                        key={item.id} 
                        style={styles.subSelectRow}
                        onPress={() => {
                          const next = new Set(exportSubheadings);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          setExportSubheadings(next);
                        }}
                      >
                        <View style={[styles.miniCheck, { backgroundColor: exportSubheadings.has(item.id) ? colors.primary : colors.surfaceStrong }]}>
                          {exportSubheadings.has(item.id) && <Check size={12} color="#fff" />}
                        </View>
                        <Text style={[styles.subSelectText, { color: colors.textPrimary }]} numberOfLines={1}>{item.text || 'Untitled Heading'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* ADVANCED CONFIGURATION TOGGLE */}
                <TouchableOpacity 
                  style={[styles.advancedToggle, { borderTopColor: colors.border }]} 
                  onPress={() => setShowAdvancedPDF(!showAdvancedPDF)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Settings size={16} color={colors.textTertiary} />
                    <Text style={[styles.advancedToggleText, { color: colors.textSecondary }]}>Advanced Configurations</Text>
                  </View>
                  {showAdvancedPDF ? <ChevronDown size={18} color={colors.textTertiary} /> : <ChevronRight size={18} color={colors.textTertiary} />}
                </TouchableOpacity>

                {showAdvancedPDF && (
                  <Animated.View style={styles.advancedArea}>
                    <View style={styles.configGroup}>
                      <Text style={[styles.configLabel, { color: colors.textTertiary }]}>PAPER STYLE & THEME</Text>
                      <View style={styles.chipRow}>
                        {['plain', 'lined', 'grid', 'dots'].map(s => (
                          <TouchableOpacity key={s} onPress={() => setPdfPaperStyle(s as any)} style={[styles.configChip, pdfPaperStyle === s && { backgroundColor: colors.primary }]}>
                            <Text style={[styles.configChipText, { color: pdfPaperStyle === s ? '#fff' : colors.textPrimary }]}>{s.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={[styles.chipRow, { marginTop: 10 }]}>
                        {['modern', 'sepia', 'historical'].map(t => (
                          <TouchableOpacity key={t} onPress={() => setPdfTheme(t as any)} style={[styles.configChip, pdfTheme === t && { backgroundColor: colors.primary }]}>
                            <Text style={[styles.configChipText, { color: pdfTheme === t ? '#fff' : colors.textPrimary }]}>{t.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.configGroup}>
                      <Text style={[styles.configLabel, { color: colors.textTertiary }]}>BRANDING & FOOTER</Text>
                      <TextInput 
                        style={[styles.configInput, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary }]}
                        placeholder="Watermark (e.g. Yogesh's Notes)"
                        value={pdfWatermark}
                        onChangeText={setPdfWatermark}
                        placeholderTextColor={colors.textTertiary}
                      />
                      <TextInput 
                        style={[styles.configInput, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary, marginTop: 8 }]}
                        placeholder="Custom Source (Footer)"
                        value={pdfFooterText}
                        onChangeText={setPdfFooterText}
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>

                    <View style={styles.configGroup}>
                      <Text style={[styles.configLabel, { color: colors.textTertiary }]}>STRUCTURE & FONT</Text>
                      <View style={styles.toggleRow}>
                         <TouchableOpacity style={[styles.toggleBtn, pdfShowTOC && { backgroundColor: colors.primary }]} onPress={() => setPdfShowTOC(!pdfShowTOC)}>
                           <Text style={[styles.toggleBtnText, { color: pdfShowTOC ? '#fff' : colors.textPrimary }]}>TOC</Text>
                         </TouchableOpacity>
                         <TouchableOpacity style={[styles.toggleBtn, pdfIncludeChecklist && { backgroundColor: colors.primary }]} onPress={() => setPdfIncludeChecklist(!pdfIncludeChecklist)}>
                           <Text style={[styles.toggleBtnText, { color: pdfIncludeChecklist ? '#fff' : colors.textPrimary }]}>Checklist</Text>
                         </TouchableOpacity>
                         <TouchableOpacity style={[styles.toggleBtn, pdfSpacing === 'compact' && { backgroundColor: colors.primary }]} onPress={() => setPdfSpacing(pdfSpacing === 'compact' ? 'comfortable' : 'compact')}>
                           <Text style={[styles.toggleBtnText, { color: pdfSpacing === 'compact' ? '#fff' : colors.textPrimary }]}>Compact</Text>
                         </TouchableOpacity>
                         <TouchableOpacity style={[styles.toggleBtn, pdfFontFamily === 'handwriting' && { backgroundColor: colors.primary }]} onPress={() => setPdfFontFamily(pdfFontFamily === 'handwriting' ? 'sans' : 'handwriting')}>
                           <Text style={[styles.toggleBtnText, { color: pdfFontFamily === 'handwriting' ? '#fff' : colors.textPrimary }]}>Handwriting</Text>
                         </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                )}

                <View style={styles.exportGrid}>
                  <TouchableOpacity style={[styles.exportGridItem, { backgroundColor: colors.primary }]} onPress={() => handleExportPDF(1)}>
                    <FileText size={20} color="#fff" />
                    <Text style={[styles.exportGridLabel, { color: '#fff' }]}>Export 1-Col</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.exportGridItem, { backgroundColor: colors.primary }]} onPress={() => handleExportPDF(2)}>
                    <Layout size={20} color="#fff" />
                    <Text style={[styles.exportGridLabel, { color: '#fff' }]}>Export 2-Col</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.exportItem} onPress={async () => {
                   try { await Share.share({ message: `${title}\n\n${content}` }); } catch (err) { console.error(err); }
                }}>
                   <View style={[styles.exportIconBox, { backgroundColor: '#dcfce7' }]}><ExternalLink size={20} color="#16a34a" /></View>
                   <View>
                      <Text style={[styles.exportLabel, { color: colors.textPrimary }]}>Plain Text Share</Text>
                      <Text style={styles.exportSub}>Copy to clipboard or other apps</Text>
                   </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.exportItem, { borderBottomWidth: 0 }]} onPress={async () => {
                   setIsExportMenuVisible(false);
                   setSaving(true);
                   try {
                      await FlashcardSvc.createFromNote(session?.user?.id, id, title, content, items);
                      Alert.alert("Success", "Note content added to flashcards!");
                   } catch (err) { console.error(err); } finally { setSaving(false); }
                }}>
                   <View style={[styles.exportIconBox, { backgroundColor: '#fae8ff' }]}><Zap size={20} color="#c026d3" /></View>
                   <View>
                      <Text style={[styles.exportLabel, { color: colors.textPrimary }]}>To Flashcards</Text>
                      <Text style={styles.exportSub}>AI generated study deck</Text>
                   </View>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}
        <AddBlockToFlashcardSheet
          visible={flashSheet.visible}
          onClose={() => setFlashSheet({ visible: false, text: '' })}
          userId={session?.user?.id ?? ''}
          noteId={id as string}
          blockId={flashSheet.blockId}
          suggestedText={flashSheet.text}
          subject={subject}
          sectionGroup={folderName}
          microtopic={title}
        />

        {/* Point Insertion Modal */}
        <Modal
          visible={insertPointData.visible}
          transparent
          animationType="slide"
          onRequestClose={() => setInsertPointData({ ...insertPointData, visible: false })}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
              style={{ flex: 1 }}
            >
              <View style={[styles.insertionContent, { backgroundColor: colors.surface }]}>
                <View style={styles.insertionHeader}>
                  <View>
                    <Text style={[styles.insertionTitle, { color: colors.textPrimary }]}>Draft New Point</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>Inserting at position {insertPointData.index + 1}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      onPress={() => {
                        const txt = insertPointData.text;
                        const { start, end } = insertSelection;
                        const left = txt.substring(0, start);
                        const right = txt.substring(end);
                        setInsertPointData({ ...insertPointData, text: left + '\n' + right });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={[styles.modalToolBtn, { backgroundColor: colors.surfaceStrong }]}
                    >
                      <Scissors size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => {
                        const txt = insertPointData.text;
                        const { start, end } = insertSelection;
                        const left = txt.substring(0, start);
                        const right = txt.substring(end);
                        setInsertPointData({ ...insertPointData, text: left + '\n• ' + right });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={[styles.modalToolBtn, { backgroundColor: colors.surfaceStrong }]}
                    >
                      <Plus size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setInsertPointData({ ...insertPointData, visible: false })} 
                      style={styles.modalCloseBtn}
                    >
                      <X size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={{ flex: 1, padding: 20 }}>
                  <View style={[styles.draftInputContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <TextInput
                      ref={insertInputRef}
                      style={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24, minHeight: 150 }}
                      multiline
                      autoFocus
                      value={insertPointData.text}
                      placeholder="Type your point here..."
                      placeholderTextColor={colors.textTertiary}
                      onChangeText={(t) => setInsertPointData({ ...insertPointData, text: t })}
                      onSelectionChange={(e) => setInsertSelection(e.nativeEvent.selection)}
                    />
                  </View>

                  <TouchableOpacity 
                    onPress={commitInsertion} 
                    style={[styles.insertionCommitBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>INSERT POINT</Text>
                  </TouchableOpacity>
                  <View style={{ height: 40 }} />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={!!activeBlockAction}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveBlockAction(null)}
        >
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setActiveBlockAction(null)}
          >
            <Animated.View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Type size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                    Point Actions
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                    {activeBlockAction?.text}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveBlockAction(null)} style={styles.closeBtn}>
                  <X size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <View style={styles.actionsContainer}>
                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => {
                    const text = activeBlockAction?.text;
                    setActiveBlockAction(null);
                    setFlashSheet({ visible: true, text: text || '', blockId: activeBlockAction?.id });
                  }}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#F59E0B10' }]}>
                    <Zap size={18} color="#F59E0B" />
                  </View>
                  <Text style={[styles.actionText, { color: colors.textPrimary }]}>Add to Flashcard</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={handleCopyBlock}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#3B82F610' }]}>
                    <Copy size={18} color="#3B82F6" />
                  </View>
                  <Text style={[styles.actionText, { color: colors.textPrimary }]}>Copy Text</Text>
                </TouchableOpacity>


                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={handleDeleteBlock}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#EF444410' }]}>
                    <Trash2 size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete Point</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>
      </View>
        </PinchGestureHandler>
      </PageWrapper>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: 12
  },
  headerBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerSub: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { padding: 4 },
  saveBtn: { padding: 4 },
  scrollContent: { padding: SPACING.lg, paddingBottom: 120 },
  titleInput: { fontSize: 24, fontWeight: '900', marginBottom: SPACING.xl },
  checklistSection: { marginBottom: SPACING.xl },
  checklistInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: 12, marginBottom: 12 },
  checklistInput: { flex: 1, height: 44, fontSize: 14, fontWeight: '600' },
  addCheckBtn: { padding: 6, borderRadius: 8 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 14, fontWeight: '500', flex: 1 },
  mainEditor: { fontSize: 16, lineHeight: 24, minHeight: 400, textAlignVertical: 'top', paddingBottom: 100 },
  bottomBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 100,
  },
  speedPointBar: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 8,
    maxHeight: 50,
  },
  speedPointContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 12,
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    borderRadius: RADIUS.md,
  },
  speedBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  highlightsContainer: { marginTop: 24, marginBottom: 24 },
  highlightsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  highlightsHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  miniAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  highlightCard: { padding: 16, borderRadius: RADIUS.lg, borderLeftWidth: 4, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  highlightText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  highlightActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  popoverPicker: { flexDirection: 'row', gap: 8, padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, marginBottom: 12 },
  colorBubble: { width: 24, height: 24, borderRadius: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 12 },
  groupHeading: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  floatingBar: { position: 'absolute', bottom: 30, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, borderWidth: 1, gap: 16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  barItem: { padding: 4 },
  barDivider: { width: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.1)' },
  heroHeader: { padding: 32, paddingBottom: 40, borderRadius: 32, marginBottom: 24, gap: 12 },
  heroIconBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  revBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  revText: { fontSize: 8, fontWeight: '900' },
  exportMenu: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 32, borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  exportTitle: { fontSize: 20, fontWeight: '900', marginBottom: 24 },
  exportItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  exportIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exportLabel: { fontSize: 15, fontWeight: '800' },
  exportSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  exportSection: { marginBottom: 24 },
  exportSubHeader: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },
  fontSizeRow: { flexDirection: 'row', gap: 8 },
  sizeBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sizeBtnText: { fontSize: 13, fontWeight: '800' },
  exportGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  exportGridItem: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', gap: 8 },
  exportGridLabel: { fontSize: 13, fontWeight: '800' },
  colorOption: { width: 44, height: 44, borderRadius: 22 },
  subheadingSelectArea: { marginBottom: 20 },
  subSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, padding: 4 },
  miniCheck: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  subSelectText: { fontSize: 13, fontWeight: '600', flex: 1 },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, marginTop: 12 },
  advancedToggleText: { fontSize: 13, fontWeight: '800' },
  advancedArea: { paddingBottom: 20 },
  configGroup: { marginBottom: 20 },
  configLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  configChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  configChipText: { fontSize: 10, fontWeight: '800' },
  configInput: { height: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 13 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleBtn: { flex: 1, minWidth: '45%', height: 40, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  toggleBtnText: { fontSize: 11, fontWeight: '800' },
  // ZEN MODE STYLES
  zenContainer: { paddingVertical: 60, paddingHorizontal: 10, alignSelf: 'center', maxWidth: 600, width: '100%' },
  zenHeader: { marginBottom: 40, alignItems: 'center' },
  zenTitle: { fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  zenDivider: { width: 60, height: 3, borderRadius: 2 },
  zenBody: { fontSize: 20, textAlign: 'center', opacity: 0.9, marginBottom: 60 },
  zenExitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 100, padding: 20, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.03)' },
  floatingZenExit: {
    position: 'absolute',
    top: 40,
    right: 24,
    zIndex: 9999,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(67, 52, 34, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSheet: {
    width: '85%',
    maxWidth: 340,
    padding: 24,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  insertPlusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    height: 24,
    width: '100%',
  },
  insertPlusLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  insertPlusBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    zIndex: 10,
  },
  insertionContent: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: 100,
    overflow: 'hidden',
  },
  insertionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  insertionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalToolBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  draftInputContainer: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  insertionCommitBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  actionsContainer: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 16,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 8,
    opacity: 0.5,
  }
});
