import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  TextInput,
  Dimensions,
  Platform,
  UIManager,
  LayoutAnimation,
  Animated as RNAnimated,
  useWindowDimensions,
  BackHandler,
  Alert,
  Modal,
  Pressable,
  Vibration,
  Share,
  Easing
} from 'react-native';
import { 
  Search, 
  ChevronRight, 
  ChevronLeft,
  Layout, 
  LayoutGrid, 
  List,
  Zap, 
  Filter, 
  Check, 
  X,
  Edit,
  Copy,
  Database,
  Target,
  Clock,
  BookOpen,
  XCircle,
  Hash,
  FileText,
  Plus,
  ArrowLeft,
  Home,
  Layers,
  FolderOpen,
  FolderPlus,
  FolderDot,
  PenLine,
  Trash2,
  FolderInput,
  Star
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ReAnimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS,
  useDerivedValue
} from 'react-native-reanimated';
import { 
  Gesture, 
  GestureDetector, 
  GestureHandlerRootView 
} from 'react-native-gesture-handler';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/context/ThemeContext';
import { spacing, radius } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { useNotesPilotVault, PilotVaultSubject, PilotVaultSectionGroup, PilotVaultMicroTopic, PilotNoteNode } from '@/src/hooks/useNotesPilotVault';
import { PilotNoteCard } from '@/src/components/PilotNoteCard';
import { PageWrapper } from '@/src/components/PageWrapper';
import { RecentNotesCarousel } from '@/src/components/RecentNotesCarousel';
import { useRecentNotes } from '@/src/hooks/useRecentNotes';
import { GlobalSearchBar } from '@/src/components/GlobalSearchBar';

// Premium Animation Configuration (iPhone-like fluidity)
const PREMIUM_LAYOUT_ANIM = {
  duration: 400,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.8,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

export default function NotesProScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { loading, vaultData, filters, refresh } = useNotesPilotVault(session?.user?.id);
  const { recents, refreshRecents } = useRecentNotes();
  const params = useLocalSearchParams();
  const sid = Array.isArray(params.sid) ? params.sid[0] : params.sid;

  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(sid || null);
  
  useEffect(() => {
    setActiveSubjectId(sid || null);
  }, [sid]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const COLUMN_WIDTH = (windowWidth - spacing.lg * 3) / 2 - 1;

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedMicroTopics, setExpandedMicroTopics] = useState<Record<string, boolean>>({});
  const [actionNote, setActionNote] = useState<PilotNoteNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [moveNoteVisible, setMoveNoteVisible] = useState(false);
  const [moveTarget, setMoveTarget] = useState<any>(null);
  const [targetSubject, setTargetSubject] = useState<string | null>(null);
  const [targetSection, setTargetSection] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);
  const [moveTargetType, setMoveTargetType] = useState<'note' | 'folder' | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createType, setCreateType] = useState<'folder' | 'note'>('note');
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [isFABOpen, setIsFABOpen] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const fabAnim = useRef(new RNAnimated.Value(0)).current;
  const folderLayouts = useSharedValue<Record<string, { x: number, y: number, w: number, h: number }>>({});
  const activeHoverId = useSharedValue<string | null>(null);
  const onFolderLayout = (id: string, e: any) => {
    // Measure absolute screen position for DND hit-testing
    const target = e.target || e.currentTarget;
    if (target?.measureInWindow) {
      target.measureInWindow((x: number, y: number, w: number, h: number) => {
        if (x !== undefined) {
          folderLayouts.value = { 
            ...folderLayouts.value, 
            [id]: { x, y, w, h } 
          };
        }
      });
    }
  };

  const toggleFAB = () => {
    const toValue = isFABOpen ? 0 : 1;
    RNAnimated.spring(fabAnim, {
      toValue,
      useNativeDriver: true,
      friction: 5,
      tension: 40
    }).start();
    setIsFABOpen(!isFABOpen);
  };

  const openCreateModal = (type: 'folder' | 'note', parentId: string | null = null) => {
    setCreateType(type);
    setCreateParentId(parentId || activeSubjectId);
    setNewItemName('');
    setIsCreateModalVisible(true);
    if (isFABOpen) toggleFAB();
  };

  const getFolderPath = (folderId: string | null) => {
    const path: { id: string, name: string }[] = [{ id: '', name: 'Vault' }];
    if (!folderId) return path;
    
    const crumbs: { id: string, name: string }[] = [];
    let currId: string | null = folderId;
    let safety = 0;
    while (currId && safety < 10) {
      const folder = vaultData.allFolders?.[currId];
      if (!folder) break;
      crumbs.unshift({ id: folder.id, name: folder.name });
      currId = folder.parentId;
      safety++;
    }
    return [...path, ...crumbs];
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim() || !session?.user?.id) return;
    setLocalLoading(true);
    try {
      let noteId = null;
      if (createType === 'note') {
        const { data: note, error: nErr } = await supabase
          .from('user_notes')
          .insert({ 
            user_id: session.user.id, 
            title: newItemName, 
            items: [],
            content: '',
            subject: activeSubjectId || ''
          })
          .select()
          .single();
        if (nErr) throw nErr;
        noteId = note.id;
      }

      const { error: nodeErr } = await supabase
        .from('user_note_nodes')
        .insert({
          user_id: session.user.id,
          title: newItemName,
          type: createType,
          parent_id: createParentId,
          note_id: noteId
        });

      if (nodeErr) throw nodeErr;
      
      setIsCreateModalVisible(false);
      setNewItemName('');
      setIsFABOpen(false);
      fabAnim.setValue(0);
      refresh();
      Alert.alert("Success", `${createType === 'note' ? 'Note' : 'Folder'} created!`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not create item.");
    } finally {
      setLocalLoading(false);
    }
  };

  // iPhone-like Slide Animation State
  const slideAnim = useRef(new RNAnimated.Value(sid ? 1 : 0)).current; // 0 = Dashboard, 1 = Detail

  useEffect(() => {
    // Smooth transition for nested content
    LayoutAnimation.configureNext(RNAnimated.spring ? LayoutAnimation.Presets.easeInEaseOut : LayoutAnimation.Presets.spring);
    
    RNAnimated.timing(slideAnim, {
      toValue: activeSubjectId ? 1 : 0,
      duration: 500, // Slightly longer for premium feel
      useNativeDriver: true,
      easing: Easing.bezier(0.33, 1, 0.68, 1), // Very smooth iPhone-style easing
    }).start();
  }, [activeSubjectId]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      refreshRecents();

      // Handle Android Hardware Back
      const onBackPress = () => {
        if (activeSubjectId) {
          router.back();
          return true; // Prevent exit
        }
        return false; // Exit app
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [refresh, activeSubjectId])
  );

  const toggleSection = (secName: string) => {
    LayoutAnimation.configureNext(PREMIUM_LAYOUT_ANIM);
    setExpandedSections(prev => ({ ...prev, [secName]: !prev[secName] }));
  };

  const toggleMicroTopic = (microName: string) => {
    LayoutAnimation.configureNext(PREMIUM_LAYOUT_ANIM);
    setExpandedMicroTopics(prev => ({ ...prev, [microName]: !prev[microName] }));
  };

  const onNoteLongPress = (note: PilotNoteNode) => {
    Vibration.vibrate(50); // Added distinct vibration pulse
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log("Long press triggered for note:", note.title);
    setActionNote(note);
  };

  const handleCopyNote = async () => {
    if (!actionNote) return;
    try {
      const { data, error } = await supabase
        .from('user_notes')
        .select('content')
        .eq('id', actionNote.note_id)
        .single();
      
      if (error) throw error;
      await Share.share({
        message: data.content || '',
        title: actionNote.title
      });
    } catch (e) {
      Alert.alert("Error", "Could not copy note content.");
    } finally {
      setActionNote(null);
    }
  };

  const handleDeleteNote = async () => {
    if (!actionNote) return;
    Alert.alert(
      "Delete Note",
      "Are you sure you want to permanently delete this note?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const { error } = await supabase
                .from('user_notes')
                .delete()
                .eq('id', actionNote.note_id);
              
              if (error) throw error;
              refresh();
            } catch (e) {
              Alert.alert("Error", "Could not delete note.");
            } finally {
              setIsDeleting(false);
              setActionNote(null);
            }
          }
        }
      ]
    );
  };

  const handleMoveAction = async (targetId: string, destinationId: string | null) => {
    if (isMoving) return;
    
    // 🛡️ Safety: can't move a folder into itself
    if (targetId === destinationId) {
      Alert.alert('Invalid', 'Cannot move a folder into itself.');
      return;
    }

    setIsMoving(true);
    console.log(`[NotesMove] Moving node ${targetId} to parent ${destinationId}`);
    
    try {
      const { error } = await supabase
        .from('user_note_nodes')
        .update({ parent_id: destinationId === 'root' ? null : destinationId })
        .eq('id', targetId);

      if (error) {
        console.error("[NotesMove] Supabase Error:", error);
        if (error.message?.includes('descendant')) {
          Alert.alert('Invalid Move', 'You cannot move a folder into one of its sub-folders.');
        } else {
          Alert.alert('Error', error.message || 'Could not move item.');
        }
        return;
      }

      setMoveNoteVisible(false);
      setMoveTarget(null);
      setTargetSubject(null);
      setActionNote(null);
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error("[NotesMove] Catch Error:", e);
      Alert.alert('Error', 'An unexpected error occurred during move.');
    } finally {
      setIsMoving(false);
    }
  };

  const moveItemToFolder = async (nodeId: string, folderId: string | null) => {
    console.log(`[NotesDrag] Dropping node ${nodeId} into folder ${folderId}`);
    await handleMoveAction(nodeId, folderId);
  };

  const stats = useMemo(() => [
    { label: 'Total Notes', value: vaultData.totalCount, icon: FileText },
    { label: 'Root Folders', value: vaultData.subjects.length, icon: BookOpen },
  ], [vaultData]);

  const activeFolderData = useMemo(() => 
    vaultData.allFolders?.[activeSubjectId || ''] || null, 
    [activeSubjectId, vaultData]
  );


  const DraggableNoteCard = ({ note }: { note: PilotNoteNode }) => {
    const isPinned = note.is_pinned;
    const isPressed = useSharedValue(false);
    const offset = useSharedValue({ x: 0, y: 0 });

    const hasDragged = useSharedValue(false);

    const panGesture = Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart(() => {
        'worklet';
        isPressed.value = true;
        hasDragged.value = false;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((e) => {
        'worklet';
        offset.value = { x: e.translationX, y: e.translationY };
        // Mark as dragged if moved more than 20px in any direction
        if (Math.abs(e.translationX) > 20 || Math.abs(e.translationY) > 20) {
          hasDragged.value = true;
        }
      })
      .onEnd((e) => {
        'worklet';
        isPressed.value = false;
        
        // Drop on empty space → show picker
        runOnJS(setMoveTarget)(note);
        runOnJS(setTargetSubject)(null);
        runOnJS(setMoveNoteVisible)(true);

        offset.value = { x: 0, y: 0 };
      });

    const tapGesture = Gesture.Tap()
      .onEnd(() => {
        runOnJS(router.push)({ 
          pathname: '/notes/editor', 
          params: { id: note.note_id, title: note.title, subject: note.subject } 
        });
      });

    const longPressGesture = Gesture.LongPress()
      .onEnd(() => {
        runOnJS(setActionNote)(note);
      });

    const composedGesture = Gesture.Exclusive(panGesture, tapGesture, longPressGesture);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateX: offset.value.x },
          { translateY: offset.value.y },
          { scale: withSpring(isPressed.value ? 1.05 : 1) },
        ],
        zIndex: isPressed.value ? 1000 : 1,
        elevation: isPressed.value ? 10 : 0,
        opacity: isPressed.value ? 0.9 : 1,
      };
    });

    return (
      <GestureDetector gesture={composedGesture}>
        <ReAnimated.View style={[
          styles.noteCard, 
          { backgroundColor: colors.surface, borderColor: colors.border },
          animatedStyle
        ]}>
          <View style={[styles.noteIcon, { backgroundColor: colors.primary + '10' }]}>
            <FileText size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.noteTitle, { color: colors.textPrimary }]} numberOfLines={1}>{note.title}</Text>
            <Text style={[styles.noteDate, { color: colors.textTertiary }]}>{new Date(note.updated_at).toLocaleDateString()}</Text>
          </View>
          {isPinned && <Star size={14} color="#f59e0b" fill="#f59e0b" />}
          <ChevronRight size={16} color={colors.textTertiary} />
        </ReAnimated.View>
      </GestureDetector>
    );
  };

  // --- Recursive Tree Components ---
  const TreeMicroTopic = ({ topic, sectionId }: { topic: PilotVaultMicroTopic, sectionId: string }) => {
    const isHovered = useDerivedValue(() => activeHoverId.value === topic.id);
    const isPressed = useSharedValue(false);
    const offset = useSharedValue({ x: 0, y: 0 });

    const panGesture = Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart(() => {
        'worklet';
        isPressed.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((e) => {
        'worklet';
        offset.value = { x: e.translationX, y: e.translationY };
      })
      .onEnd((e) => {
        'worklet';
        isPressed.value = false;
        
        const x = e.absoluteX;
        const y = e.absoluteY;
        let hitFolderId: string | null = null;
        const layouts = folderLayouts.value;
        for (const [id, box] of Object.entries(layouts)) {
          if (id === topic.id) continue;
          if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
            hitFolderId = id;
            break;
          }
        }

        if (hitFolderId) {
          runOnJS(moveItemToFolder)(topic.id, hitFolderId);
        } else if (Math.abs(e.translationX) > 20 || Math.abs(e.translationY) > 20) {
          runOnJS(setMoveTarget)(topic);
          runOnJS(setTargetSubject)(null);
          runOnJS(setMoveNoteVisible)(true);
        }
        offset.value = { x: 0, y: 0 };
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: offset.value.x },
        { translateY: offset.value.y },
        { scale: withSpring(isHovered.value || isPressed.value ? 1.05 : 1) }
      ],
      backgroundColor: isHovered.value ? colors.primary + '10' : 'transparent',
      zIndex: isPressed.value ? 1000 : 1,
    }));

    return (
      <GestureDetector gesture={panGesture}>
        <ReAnimated.View 
          onLayout={(e) => onFolderLayout(topic.id, e.nativeEvent)}
          style={[styles.treeRow, { paddingLeft: 40 }]}
        >
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/notes', params: { sid: topic.id } })}
            onLongPress={() => {
              Vibration.vibrate(50);
              Alert.alert("Folder Actions", `Manage "${topic.name}"`, [
                { text: "Move Folder", onPress: () => { 
                  setMoveTarget(topic); 
                  setTargetSubject(null); 
                  setMoveNoteVisible(true); 
                } },
                { text: "Rename", onPress: () => Alert.alert("Coming Soon", "Rename feature is being optimized.") },
                { text: "Delete Folder", style: "destructive", onPress: () => Alert.alert("Coming Soon", "Safe-delete is being optimized.") },
                { text: "Cancel", style: "cancel" }
              ]);
            }}
            activeOpacity={0.7}
            style={{ flex: 1 }}
          >
            <ReAnimated.View style={[{ flexDirection: 'row', alignItems: 'center', flex: 1, padding: 6, borderRadius: 12 }, animatedStyle]}>
              <View style={[styles.folderIconSmall, { backgroundColor: colors.primary + '10' }]}>
                 <FolderOpen size={14} color={colors.primary} />
              </View>
              <Text style={[styles.treeText, { color: colors.textPrimary }]}>{topic.name}</Text>
              <Text style={styles.treeCount}>{topic.notes.length} notes</Text>
              <ChevronRight size={14} color={colors.textTertiary} />
            </ReAnimated.View>
          </TouchableOpacity>
        </ReAnimated.View>
      </GestureDetector>
    );
  };

  const TreeSection = ({ section, subjectId }: { section: PilotVaultSectionGroup, subjectId: string }) => {
    const isHovered = useDerivedValue(() => activeHoverId.value === section.id);
    const isPressed = useSharedValue(false);
    const offset = useSharedValue({ x: 0, y: 0 });

    const panGesture = Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart(() => {
        'worklet';
        isPressed.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((e) => {
        'worklet';
        offset.value = { x: e.translationX, y: e.translationY };
      })
      .onEnd((e) => {
        'worklet';
        isPressed.value = false;
        
        const x = e.absoluteX;
        const y = e.absoluteY;
        let hitFolderId: string | null = null;
        const layouts = folderLayouts.value;
        for (const [id, box] of Object.entries(layouts)) {
          if (id === section.id) continue;
          if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
            hitFolderId = id;
            break;
          }
        }

        if (hitFolderId) {
          runOnJS(moveItemToFolder)(section.id, hitFolderId);
        } else if (Math.abs(e.translationX) > 20 || Math.abs(e.translationY) > 20) {
          runOnJS(setMoveTarget)(section);
          runOnJS(setTargetSubject)(null);
          runOnJS(setMoveNoteVisible)(true);
        }
        offset.value = { x: 0, y: 0 };
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: offset.value.x },
        { translateY: offset.value.y },
        { scale: withSpring(isHovered.value || isPressed.value ? 1.05 : 1) }
      ],
      backgroundColor: isHovered.value ? colors.primary + '10' : 'transparent',
      zIndex: isPressed.value ? 1000 : 1,
    }));

    return (
      <GestureDetector gesture={panGesture}>
        <ReAnimated.View 
          onLayout={(e) => onFolderLayout(section.id, e.nativeEvent)}
          style={[styles.treeRow, { paddingLeft: 20 }]}
        >
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/notes', params: { sid: section.id } })}
            onLongPress={() => {
              Vibration.vibrate(50);
              Alert.alert("Folder Actions", `Manage "${section.name}"`, [
                { text: "Move Folder", onPress: () => { 
                  setMoveTarget(section); 
                  setTargetSubject(null); 
                  setMoveNoteVisible(true); 
                } },
                { text: "Rename", onPress: () => Alert.alert("Coming Soon", "Rename feature is being optimized.") },
                { text: "Delete Folder", style: "destructive", onPress: () => Alert.alert("Coming Soon", "Safe-delete is being optimized.") },
                { text: "Cancel", style: "cancel" }
              ]);
            }}
            activeOpacity={0.7}
            style={{ flex: 1 }}
          >
            <ReAnimated.View style={[{ flexDirection: 'row', alignItems: 'center', flex: 1, padding: 8, borderRadius: 12 }, animatedStyle]}>
              <View style={[styles.folderIconSmall, { backgroundColor: '#10b981' + '10' }]}>
                 <FolderOpen size={16} color="#10b981" />
              </View>
              <Text style={[styles.treeText, { color: colors.textPrimary, fontWeight: '700' }]}>{section.name}</Text>
              <Text style={styles.treeCount}>{section.totalCount} items</Text>
              <ChevronRight size={16} color={colors.textTertiary} />
            </ReAnimated.View>
          </TouchableOpacity>
        </ReAnimated.View>
      </GestureDetector>
    );
  };

  const SubjectCard = ({ subject }: { subject: PilotVaultSubject }) => {
    const isHovered = useDerivedValue(() => activeHoverId.value === subject.id);
    const isPressed = useSharedValue(false);
    const offset = useSharedValue({ x: 0, y: 0 });

    const panGesture = Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart(() => {
        'worklet';
        isPressed.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((e) => {
        'worklet';
        offset.value = { x: e.translationX, y: e.translationY };
      })
      .onEnd((e) => {
        'worklet';
        isPressed.value = false;
        
        const x = e.absoluteX;
        const y = e.absoluteY;
        let hitFolderId: string | null = null;
        const layouts = folderLayouts.value;
        for (const [id, box] of Object.entries(layouts)) {
          if (id === subject.id) continue;
          if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
            hitFolderId = id;
            break;
          }
        }

        if (hitFolderId) {
          runOnJS(moveItemToFolder)(subject.id, hitFolderId);
        } else if (Math.abs(e.translationX) > 20 || Math.abs(e.translationY) > 20) {
          runOnJS(setMoveTarget)(subject);
          runOnJS(setTargetSubject)(null);
          runOnJS(setMoveNoteVisible)(true);
        }
        offset.value = { x: 0, y: 0 };
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: offset.value.x },
        { translateY: offset.value.y },
        { scale: withSpring(isHovered.value || isPressed.value ? 1.05 : 1) }
      ],
      borderColor: isHovered.value ? colors.primary : 'rgba(255, 255, 255, 0.4)',
      backgroundColor: isHovered.value ? colors.primary + '05' : colors.surface,
      zIndex: isPressed.value ? 1000 : 1,
    }));

    return (
      <GestureDetector gesture={panGesture}>
        <ReAnimated.View 
          onLayout={(e) => onFolderLayout(subject.id, e.nativeEvent)}
          style={{ width: COLUMN_WIDTH }}
        >
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/notes', params: { sid: subject.id } })}
            onLongPress={() => {
              Vibration.vibrate(50);
              Alert.alert("Notebook Actions", `Manage "${subject.name}"`, [
                { text: "Move Folder", onPress: () => { 
                  setMoveTarget(subject); 
                  setTargetSubject(null); 
                  setMoveNoteVisible(true); 
                } },
                { text: "Rename", onPress: () => Alert.alert("Coming Soon", "Rename feature is being optimized.") },
                { text: "Delete Folder", style: "destructive", onPress: () => Alert.alert("Coming Soon", "Safe-delete is being optimized.") },
                { text: "Cancel", style: "cancel" }
              ]);
            }}
            activeOpacity={0.8}
            style={{ flex: 1 }}
          >
            <ReAnimated.View style={[styles.subjectCard, animatedStyle]}>
              <View style={[styles.subjectIcon, { backgroundColor: colors.primary + '10' }]}>
                 <FolderOpen size={20} color={colors.primary} />
              </View>
              <Text style={[styles.subjectName, { color: colors.textPrimary }]} numberOfLines={1}>{subject.name}</Text>
              <Text style={[styles.subjectCount, { color: colors.textTertiary }]}>{subject.totalCount} items</Text>
            </ReAnimated.View>
          </TouchableOpacity>
        </ReAnimated.View>
      </GestureDetector>
    );
  };

  const TreeSubject = ({ subject }: { subject: PilotVaultSubject }) => {
    const isExpanded = expandedSections[subject.id];
    return (
      <View style={styles.treeNode}>
        <TouchableOpacity 
          onPress={() => toggleSection(subject.id)}
          style={[styles.treeRow, { backgroundColor: colors.surfaceStrong + '10', borderRadius: 12 }]}
          activeOpacity={0.7}
        >
          <BookOpen size={18} color={isExpanded ? colors.primary : colors.textTertiary} />
          <Text style={[styles.treeText, { color: colors.textPrimary, fontWeight: '800', fontSize: 15 }]}>{subject.name}</Text>
          <ChevronRight size={16} color={colors.textTertiary} style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }} />
        </TouchableOpacity>
        {isExpanded && (
          <View>
            {Object.values(subject.sectionGroups).map(section => (
              <TreeSection key={section.id} section={section} subjectId={subject.id} />
            ))}
            {subject.notes.map(note => (
              <View style={{ paddingLeft: 20 }} key={note.id}>
                <PilotNoteCard note={note} onLongPress={onNoteLongPress} />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Interpolations for Dashboard and Detail transitions
  // --- Refined Native-Like Transitions ---
  // Dashboard recedes and dims
  const dashboardTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -windowWidth * 0.25], // Parallax shift
  });
  const dashboardOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4], 
  });
  const dashboardScale = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.97],
  });

  // Detail slides in from right
  const detailTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [windowWidth, 0],
  });
  const detailOpacity = slideAnim.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageWrapper>
        <View style={styles.container}>
          {/* DASHBOARD LAYER (Always at bottom) */}
          <RNAnimated.View style={[
            styles.layer,
            {
              opacity: dashboardOpacity,
              transform: [
                { translateX: dashboardTranslateX },
                { scale: dashboardScale }
              ]
            }
          ]}>
              <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backButtonHero}>
                  <Home size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
              </View>

              <View style={{ marginHorizontal: spacing.lg, marginVertical: 8 }}>
                <GlobalSearchBar 
                  placeholder="Search notes pro..." 
                  onChangeText={filters.setSearchQuery}
                  onSearch={(q, f) => {
                    router.push({
                      pathname: '/unified/arena',
                      params: { 
                        tab: 'search',
                        query: q,
                        filters: JSON.stringify(f)
                      }
                    });
                  }}
                />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mainScroll}>
                <View style={styles.statsRow}>
                  {stats.map((stat, idx) => (
                    <View key={idx} style={[styles.statCard, { backgroundColor: colors.surface }]}>
                      <stat.icon size={20} color={colors.primary} />
                      <View>
                        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{stat.label}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <RecentNotesCarousel recents={recents} />

                <View style={styles.gridHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes Pro</Text>
                  <View style={styles.viewToggle}>
                    <TouchableOpacity onPress={() => setViewMode('grid')} style={styles.iconBtn}>
                      <LayoutGrid size={22} color={viewMode === 'grid' ? colors.primary : colors.textTertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setViewMode('list')} style={styles.iconBtn}>
                      <List size={22} color={viewMode === 'list' ? colors.primary : colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={viewMode === 'grid' ? styles.grid : styles.treeContainer}>
                  {vaultData.subjects.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Database size={48} color={colors.textTertiary} opacity={0.3} />
                      <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No notes found.</Text>
                    </View>
                  ) : (
                    viewMode === 'grid' ? (
                        vaultData.subjects.map(subject => (
                          <SubjectCard key={subject.id} subject={subject} />
                        ))
                    ) : (
                      vaultData.subjects.map(subject => (
                        <TreeSubject key={subject.id} subject={subject} />
                      ))
                    )
                  )}
                </View>
              </ScrollView>
          </RNAnimated.View>

          {/* DETAIL LAYER (Slides in over Dashboard) */}
          <RNAnimated.View style={[
            styles.detailLayer,
            {
              transform: [{ translateX: detailTranslateX }],
              opacity: detailOpacity,
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: colors.bg,
              shadowColor: '#000',
              shadowOffset: { width: -2, height: 0 },
              shadowOpacity: 0.1,
              shadowRadius: 5,
              elevation: 5,
            }
          ]}>
            <View style={[styles.heroHeader, { backgroundColor: colors.surface }]}>
              <View style={styles.heroHeaderTop}>
                <TouchableOpacity 
                  onPress={() => router.back()} 
                  style={styles.backButtonHero}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => router.replace('/(tabs)')} 
                  style={[styles.backButtonHero, { marginLeft: 12 }]}
                  activeOpacity={0.7}
                >
                  <Home size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <View style={[styles.heroIconBox, { backgroundColor: colors.primary + '20' }]}>
                  <FolderOpen size={24} color={colors.primary} />
                </View>
              </View>

              {/* BREADCRUMBS */}
              <View style={styles.breadcrumbContainer}>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(() => {
                      const path = getFolderPath(activeSubjectId);
                      return path.map((f, idx) => (
                         <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {idx > 0 && <ChevronRight size={14} color={colors.textTertiary} style={{ marginHorizontal: 4 }} />}
                            <TouchableOpacity onPress={() => router.push({ pathname: '/notes', params: { sid: f.id } })}>
                               <Text style={[styles.breadcrumbText, { color: idx === path.length - 1 ? colors.primary : colors.textTertiary }]}>
                                  {f.name}
                               </Text>
                            </TouchableOpacity>
                         </View>
                      ));
                    })()}
                 </ScrollView>
              </View>

              <Text style={[styles.heroTitle, { color: colors.textPrimary, marginTop: 8 }]}>{activeFolderData?.name || 'Folder'}</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textTertiary }]}>
                {activeFolderData?.totalCount || activeFolderData?.notes?.length || 0} items inside
              </Text>
            </View>
            
            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
              {/* 1. Subfolders (Section Groups) */}
              {activeFolderData?.sectionGroups && Object.values(activeFolderData.sectionGroups).map((section: any) => (
                <TreeSection key={section.id} section={section} subjectId={activeFolderData.id} />
              ))}

              {/* 2. Sub-subfolders (Micro Topics) */}
              {activeFolderData?.microTopics && Object.values(activeFolderData.microTopics).map((topic: any) => (
                <TreeMicroTopic key={topic.id} topic={topic} sectionId={activeFolderData.id} />
              ))}

              {/* 3. Direct Notes */}
              {activeFolderData?.notes && activeFolderData.notes.map((note: any) => (
                <DraggableNoteCard key={note.id} note={note} />
              ))}
            </ScrollView>
          </RNAnimated.View>

          {/* FAB & Creation Hub - MOVED INSIDE container */}
          <View style={styles.fabContainer}>
            {isFABOpen && (
              <View style={styles.fabOptions}>
                {!activeSubjectId ? (
                  /* ROOT LEVEL OPTIONS */
                  <RNAnimated.View style={[styles.fabOptionItem, { transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], opacity: fabAnim }]}>
                    <Text style={[styles.fabOptionLabel, { color: colors.textPrimary }]}>New Root Folder</Text>
                    <TouchableOpacity onPress={() => openCreateModal('folder', null)} style={[styles.fabMiniBtn, { backgroundColor: '#6366f1' }]}>
                      <FolderDot size={20} color="#fff" />
                    </TouchableOpacity>
                  </RNAnimated.View>
                ) : (
                  /* INSIDE FOLDER OPTIONS */
                  <>
                    <RNAnimated.View style={[styles.fabOptionItem, { transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], opacity: fabAnim }]}>
                      <Text style={[styles.fabOptionLabel, { color: colors.textPrimary }]}>New Note</Text>
                      <TouchableOpacity onPress={() => openCreateModal('note', activeSubjectId)} style={[styles.fabMiniBtn, { backgroundColor: colors.primary }]}>
                        <PenLine size={20} color="#fff" />
                      </TouchableOpacity>
                    </RNAnimated.View>
 
                    <RNAnimated.View style={[styles.fabOptionItem, { transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], opacity: fabAnim }]}>
                      <Text style={[styles.fabOptionLabel, { color: colors.textPrimary }]}>New Subfolder</Text>
                      <TouchableOpacity onPress={() => openCreateModal('folder', activeSubjectId)} style={[styles.fabMiniBtn, { backgroundColor: '#10b981' }]}>
                        <FolderPlus size={20} color="#fff" />
                      </TouchableOpacity>
                    </RNAnimated.View>
                  </>
                )}
              </View>
            )}
            <TouchableOpacity 
              onPress={toggleFAB} 
              style={[styles.fabMain, { backgroundColor: colors.primary, transform: [{ rotate: isFABOpen ? '45deg' : '0deg' }] }]}
              activeOpacity={0.9}
            >
              <Plus size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Creation Modal */}
        <Modal
          visible={isCreateModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCreateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.createModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Create New {createType === 'note' ? 'Notebook' : 'Folder'}
              </Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder={`Enter ${createType} name...`}
                placeholderTextColor={colors.textTertiary}
                value={newItemName}
                onChangeText={setNewItemName}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setIsCreateModalVisible(false)} style={styles.modalBtn}>
                  <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleCreateItem} 
                  style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: colors.primary, opacity: localLoading ? 0.6 : 1 }]}
                  disabled={localLoading}
                >
                  {localLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </PageWrapper>

      <Modal
        visible={!!actionNote}
        transparent
        animationType="fade"
        onRequestClose={() => setActionNote(null)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setActionNote(null)}
        >
          <RNAnimated.View 
            style={[styles.actionSheet, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIcon, { backgroundColor: colors.primary + '15' }]}>
                <FileText size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {actionNote?.title}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textTertiary }]}>
                  Note Actions
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActionNote(null)} style={styles.closeBtn}>
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => {
                  const note = actionNote;
                  setActionNote(null);
                  router.push({ 
                    pathname: '/notes/editor', 
                    params: { id: note?.note_id, title: note?.title, subject: note?.subject } 
                  });
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '10' }]}>
                  <Edit size={18} color={colors.primary} />
                </View>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>Edit Note</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem}
                onPress={handleCopyNote}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#3B82F610' }]}>
                  <Copy size={18} color="#3B82F6" />
                </View>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>Copy Content</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => {
                  setMoveTarget(actionNote);
                  setTargetSubject(null);
                  setActionNote(null);
                  setMoveNoteVisible(true);
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#10B98110' }]}>
                  <FolderInput size={18} color="#10B981" />
                </View>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>Change Subheading</Text>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <TouchableOpacity 
                style={styles.actionItem}
                onPress={handleDeleteNote}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#EF444410' }]}>
                  <Trash2 size={18} color="#EF4444" />
                </View>
                <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete Note</Text>
              </TouchableOpacity>
            </View>
          </RNAnimated.View>
        </Pressable>
      </Modal>
      <Modal
        visible={moveNoteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveNoteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} 
            onPress={() => setMoveNoteVisible(false)} 
          />
          <View style={[styles.actionSheet, { backgroundColor: colors.surface, width: '90%', maxHeight: '85%' }]}>
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIcon, { backgroundColor: '#10B98115' }]}>
                <FolderInput size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Move "{moveTarget?.title || moveTarget?.name || 'Item'}"</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textTertiary }]}>Select destination folder</Text>
              </View>
              <TouchableOpacity onPress={() => setMoveNoteVisible(false)} style={styles.closeBtn}>
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <Text style={[styles.moveLabel, { color: colors.textTertiary }]}>SELECT DESTINATION</Text>
              <View style={styles.moveList}>
                {/* Root Option */}
                <TouchableOpacity 
                  style={[styles.moveItem, { 
                    borderColor: targetSubject === 'root' ? colors.primary : colors.border,
                    backgroundColor: targetSubject === 'root' ? colors.primary + '15' : 'transparent',
                    borderWidth: targetSubject === 'root' ? 2 : 1,
                  }]}
                  onPress={() => { setTargetSubject('root'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <View style={[styles.moveItemIcon, { backgroundColor: (targetSubject === 'root' ? colors.primary : colors.textTertiary) + '15' }]}>
                    <Layout size={16} color={targetSubject === 'root' ? colors.primary : colors.textTertiary} />
                  </View>
                  <Text style={[styles.moveItemText, { color: targetSubject === 'root' ? colors.textPrimary : colors.textSecondary, fontWeight: '800' }]}>📁  Main Dashboard (Root)</Text>
                  {targetSubject === 'root' && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>

                {/* Hierarchical Folders */}
                {(() => {
                  const items: any[] = [];
                  const rootFolders = Object.values(vaultData.allFolders || {}).filter((f: any) => !f.parentId && f.id !== moveTarget?.id);
                  rootFolders.forEach((folder: any) => {
                    items.push({ ...folder, depth: 0 });
                    const children = Object.values(vaultData.allFolders || {}).filter((f: any) => f.parentId === folder.id && f.id !== moveTarget?.id);
                    children.forEach((child: any) => {
                      items.push({ ...child, depth: 1 });
                      const grandChildren = Object.values(vaultData.allFolders || {}).filter((f: any) => f.parentId === child.id && f.id !== moveTarget?.id);
                      grandChildren.forEach((gc: any) => {
                        items.push({ ...gc, depth: 2 });
                      });
                    });
                  });
                  
                  return items.map((folder: any) => {
                    const isSelected = targetSubject === folder.id;
                    const depthColors = ['#6366f1', '#10b981', '#f59e0b'];
                    const depthIcons = ['📂', '📁', '📄'];
                    const accentColor = depthColors[folder.depth] || colors.primary;
                    
                    return (
                      <TouchableOpacity 
                        key={folder.id} 
                        style={[styles.moveItem, { 
                          borderColor: isSelected ? accentColor : colors.border,
                          backgroundColor: isSelected ? accentColor + '15' : 'transparent',
                          marginLeft: folder.depth * 20,
                          borderWidth: isSelected ? 2 : 1,
                        }]}
                        onPress={() => {
                          setTargetSubject(folder.id);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text style={{ fontSize: 16, marginRight: 6 }}>{depthIcons[folder.depth]}</Text>
                        <View style={[styles.moveItemIcon, { backgroundColor: (isSelected ? accentColor : colors.textTertiary) + '15' }]}>
                          <FolderOpen size={14} color={isSelected ? accentColor : colors.textTertiary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.moveItemText, { color: isSelected ? colors.textPrimary : colors.textSecondary, fontWeight: folder.depth === 0 ? '800' : '600' }]}>{folder.name}</Text>
                          {folder.depth > 0 && (
                            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>
                              {folder.depth === 1 ? 'Subfolder' : 'Sub-subfolder'}
                            </Text>
                          )}
                        </View>
                        {isSelected && <Check size={16} color={accentColor} />}
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
            </ScrollView>

            <TouchableOpacity 
              disabled={!targetSubject || isMoving}
              style={[styles.moveSubmitBtn, { 
                backgroundColor: targetSubject ? colors.primary : colors.border,
                opacity: !targetSubject ? 0.5 : (isMoving ? 0.6 : 1),
              }]}
              onPress={() => {
                if (!targetSubject || isMoving || !moveTarget) {
                  Alert.alert('Pick a destination', 'Tap a folder above (or "Main Dashboard") before confirming.');
                  return;
                }
                handleMoveAction(moveTarget.id, targetSubject);
              }}
              activeOpacity={0.7}
            >
              {isMoving ? <ActivityIndicator color="#fff" /> : <Text style={styles.moveSubmitText}>Confirm Move</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  layer: { flex: 1, width: '100%' },
  detailLayer: { 
    position: 'absolute', 
    top: 0, 
    bottom: 0, 
    right: 0, 
    left: 0, 
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: -10, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  commandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    margin: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 8 },
  mainScroll: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.xl },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 12,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: '900' },
  viewToggle: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 },
  iconBtn: { padding: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  treeContainer: { gap: 8 },
  treeNode: { marginBottom: 2 },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    gap: 16,
  },
  noteIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  noteDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  treeRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    gap: 12,
  },
  treeText: { fontSize: 14, flex: 1 },
  treeCount: { fontSize: 10, fontWeight: '800', opacity: 0.5 },
  subjectCard: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
  },
  subjectIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  folderIconSmall: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 15, fontWeight: '800' },
  subjectCount: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  heroHeader: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  heroHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButtonHero: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailScroll: { padding: spacing.lg, paddingBottom: 100 },
  sectionContainer: { marginBottom: spacing.md },
  emptyState: { width: '100%', padding: 60, alignItems: 'center' },
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
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
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  },
  moveLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  moveList: {
    gap: 8,
  },
  moveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  moveItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveItemText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  moveInput: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moveChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  moveChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  moveSubmitBtn: {
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  moveSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 90,
    right: 30,
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  fabOptions: {
    marginBottom: 15,
    alignItems: 'flex-end',
    gap: 12,
  },
  fabOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fabOptionLabel: {
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  fabMiniBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  fabMain: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  createModal: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
});
