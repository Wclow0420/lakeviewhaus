import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pill } from '@/components/ui/Pill';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { BaseModal } from '@/components/ui/BaseModal';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

interface OptionItem {
    name: string;
    price: string;
}

interface OptionGroup {
    id?: number;
    name: string;
    min_selection: number;
    max_selection: number;
    items: OptionItem[];
    isExpanded?: boolean; // UI State
}

interface ProductFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    categories: { id: number; name: string }[];
    initialData?: any;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ visible, onClose, onSubmit, categories, initialData }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    // Basic Info
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [catId, setCatId] = useState<number | null>(null);
    const [imageUrl, setImageUrl] = useState('');
    const [isRecommended, setIsRecommended] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [loading, setLoading] = useState(false);

    // Variant State
    const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

    // Library State
    const [libraryGroups, setLibraryGroups] = useState<OptionGroup[]>([]);
    const [showLibrary, setShowLibrary] = useState(false);

    // Initial Fetch & Reset
    useEffect(() => {
        if (visible) {
            // Fetch Library
            try {
                api.menu.getOptionGroups().then((data: any[]) => {
                    setLibraryGroups(data.map(g => ({
                        id: g.id,
                        name: g.name,
                        min_selection: g.min_selection,
                        max_selection: g.max_selection,
                        items: g.items.map((it: any) => ({
                            name: it.name,
                            price: it.price_adjustment?.toString() || '0'
                        }))
                    })));
                }).catch(err => console.log("Failed to load library", err));
            } catch (e) { }

            if (initialData) {
                // Edit Mode
                setName(initialData.name);
                setPrice(initialData.price?.toString() || '');
                setDescription(initialData.description || '');
                setCatId(initialData.category_id);
                setCatId(initialData.category_id);
                setImageUrl(initialData.image_url || '');
                setIsRecommended(initialData.is_recommended || false);
                setIsNew(initialData.is_new || false);

                if (initialData.options) {
                    setOptionGroups(initialData.options.map((grp: any) => ({
                        id: grp.id,
                        name: grp.name,
                        min_selection: grp.min_selection ?? grp.min ?? 0,
                        max_selection: grp.max_selection ?? grp.max ?? 1,
                        items: grp.items.map((it: any) => ({
                            name: it.name,
                            price: it.price_adjustment?.toString() || it.price?.toString() || ''
                        })),
                        isExpanded: false // Collapsed by default on edit load
                    })));
                } else {
                    setOptionGroups([]);
                }
            } else {
                // Create Mode
                setName(''); setPrice(''); setDescription(''); setCatId(null); setImageUrl('');
                setIsRecommended(false); setIsNew(false);
                setOptionGroups([]);
            }
            setShowLibrary(false);
        }
    }, [visible, initialData]);

    const addOptionGroup = () => {
        setOptionGroups([...optionGroups, {
            name: '',
            min_selection: 0,
            max_selection: 1,
            items: [{ name: '', price: '' }],
            isExpanded: true // Auto-expand new group
        }]);
    };

    const addLibraryGroup = (group: OptionGroup) => {
        setOptionGroups([...optionGroups, {
            ...group,
            isExpanded: false // Keep collapsed if importing
        }]);
        setShowLibrary(false);
    };

    const toggleExpand = (index: number) => {
        setOptionGroups(prev => prev.map((g, i) => i === index ? { ...g, isExpanded: !g.isExpanded } : g));
    };

    const removeGroup = (index: number) => {
        setOptionGroups(prev => prev.filter((_, i) => i !== index));
    };

    const updateGroup = (index: number, field: keyof OptionGroup, value: any) => {
        setOptionGroups(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
    };

    const addOption = (groupIndex: number) => {
        setOptionGroups(prev => prev.map((g, i) =>
            i === groupIndex ? { ...g, items: [...g.items, { name: '', price: '' }] } : g
        ));
    };

    const removeOption = (groupIndex: number, optionIndex: number) => {
        setOptionGroups(prev => prev.map((g, i) =>
            i === groupIndex ? { ...g, items: g.items.filter((_, oi) => oi !== optionIndex) } : g
        ));
    };

    const updateOption = (groupIndex: number, optionIndex: number, field: keyof OptionItem, value: string) => {
        setOptionGroups(prev => prev.map((g, i) => {
            if (i !== groupIndex) return g;
            const newItems = g.items.map((item, oi) => oi === optionIndex ? { ...item, [field]: value } : item);
            return { ...g, items: newItems };
        }));
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        // @ts-ignore
        formData.append('file', { uri, name: filename, type });

        try {
            // Use raw api call via services/api wrapper that handles FormData
            // We need to cast api to any because our typed api might not have post explicitly typed for FormData return
            const res: any = await api.post('/upload', formData);
            if (res.url) {
                setImageUrl(res.url);
            }
        } catch (e) {
            console.log("Upload failed", e);
            alert("Failed to upload image");
        }
    };

    const handleSubmit = async () => {
        if (!name || !price || !catId) {
            return alert('Please fill in Name, Price and Category');
        }
        setLoading(true);
        try {
            const formattedOptions = optionGroups.map(g => ({
                id: g.id,
                name: g.name,
                min: g.min_selection,
                max: g.max_selection,
                items: g.items.map(opt => ({
                    name: opt.name,
                    price: parseFloat(opt.price || '0')
                })).filter(o => o.name)
            })).filter(g => g.name);

            await onSubmit({
                name,
                price: parseFloat(price),
                description,
                category_id: catId,
                image_url: imageUrl,
                options: formattedOptions,
                is_recommended: isRecommended, // Add to payload
                is_new: isNew // Add to payload
            });
        } catch (e) {

        } finally {
            setLoading(false);
        }
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title={initialData ? 'Edit Product' : 'New Product'}
            scrollable={false}
        >
            {/* Keyboard Handling */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                >
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Image Placeholder */}
                        {/* Image Placeholder */}
                        <TouchableOpacity
                            style={[styles.imageUpload, { backgroundColor: theme.card, borderColor: theme.border, overflow: 'hidden' }]}
                            onPress={pickImage}
                        >
                            {imageUrl ? (
                                <Image source={{ uri: imageUrl.startsWith('http') || imageUrl.startsWith('file') ? imageUrl : `${API_URL}${imageUrl}` }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                                <>
                                    <Ionicons name="camera-outline" size={40} color={theme.icon} />
                                    <Text style={{ color: theme.icon, marginTop: 8 }}>Add Photo</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={{ gap: 16, padding: 24 }}>
                            <Input label="Product Name" placeholder="e.g. Latte" value={name} onChangeText={setName} />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Input label="Price (RM)" placeholder="0.00" keyboardType="numeric" value={price} onChangeText={setPrice} />
                                </View>
                                {/* Spacer or other fields could go here, or just Price half width */}
                                <View style={{ flex: 1 }} />
                            </View>

                            {/* Category Selector */}
                            <View>
                                <Text style={{ color: theme.text, marginBottom: 8, fontWeight: '600' }}>Category</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {categories.map(c => (
                                        <Pill
                                            key={c.id}
                                            label={c.name}
                                            selected={catId === c.id}
                                            onPress={() => setCatId(c.id)}
                                            activeColor={theme.primary}
                                        />
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                <View style={styles.switchRow}>
                                    <Text style={{ color: theme.text, fontWeight: '600' }}>Recommended</Text>
                                    <Switch
                                        value={isRecommended}
                                        onValueChange={setIsRecommended}
                                        trackColor={{ true: theme.primary, false: '#767577' }}
                                    />
                                </View>
                                <View style={styles.switchRow}>
                                    <Text style={{ color: theme.text, fontWeight: '600' }}>New Item</Text>
                                    <Switch
                                        value={isNew}
                                        onValueChange={setIsNew}
                                        trackColor={{ true: theme.primary, false: '#767577' }}
                                    />
                                </View>
                            </View>

                            <Input label="Description" placeholder="Optional details..." value={description} onChangeText={setDescription} multiline style={{ height: 80 }} />

                            {/* --- Options Section --- */}
                            <View style={{ marginTop: 10 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <Text style={[styles.title, { fontSize: 18, color: theme.text }]}>Options & Add-ons</Text>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity onPress={() => setShowLibrary(!showLibrary)}>
                                            <Text style={{ color: theme.secondary, fontWeight: '600' }}>Import</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={addOptionGroup}>
                                            <Text style={{ color: theme.primary, fontWeight: '600' }}>+ New</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {showLibrary && (
                                    <View style={[styles.libraryContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <Text style={{ color: theme.icon, marginBottom: 8, fontSize: 12 }}>Tap to add to product:</Text>
                                        {libraryGroups.length === 0 ? (
                                            <Text style={{ color: theme.text, padding: 8 }}>No shared options found.</Text>
                                        ) : (
                                            <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                                                {libraryGroups.map(g => (
                                                    <TouchableOpacity
                                                        key={g.id}
                                                        onPress={() => addLibraryGroup(g)}
                                                        style={{ padding: 10, borderBottomWidth: 0.5, borderColor: theme.border }}
                                                    >
                                                        <Text style={{ color: theme.text, fontWeight: '600' }}>{g.name}</Text>
                                                        <Text style={{ color: theme.icon, fontSize: 10 }}>
                                                            {g.items.length} choices
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        )}
                                    </View>
                                )}

                                {optionGroups.map((group, gIndex) => (
                                    <View key={gIndex} style={[styles.variantCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        {/* Group Header (Always Visible) */}
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => toggleExpand(gIndex)}
                                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>
                                                    {group.name || "Untitled Group"}
                                                </Text>
                                                <Text style={{ color: theme.icon, fontSize: 12 }}>
                                                    {group.items.length} choices · {group.max_selection > 1 ? "Checkboxes" : "Radio"}
                                                    {group.id && " · Shared"}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <TouchableOpacity onPress={() => removeGroup(gIndex)}>
                                                    <Ionicons name="trash-outline" size={20} color="red" />
                                                </TouchableOpacity>
                                                <Ionicons name={group.isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.icon} />
                                            </View>
                                        </TouchableOpacity>

                                        {/* Expanded Body */}
                                        {group.isExpanded && (
                                            <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: theme.border, paddingTop: 12 }}>
                                                <View style={{ gap: 10, marginBottom: 10 }}>
                                                    <Input
                                                        placeholder="Group Name (e.g. Ice Level)"
                                                        value={group.name}
                                                        onChangeText={(text) => updateGroup(gIndex, 'name', text)}
                                                    />
                                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                                        <TouchableOpacity
                                                            style={[styles.chip, group.max_selection === 1 && { backgroundColor: theme.primary }]}
                                                            onPress={() => updateGroup(gIndex, 'max_selection', 1)}
                                                        >
                                                            <Text style={{ color: group.max_selection === 1 ? '#fff' : theme.text, fontSize: 12 }}>Single Choice</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.chip, group.max_selection > 1 && { backgroundColor: theme.primary }]}
                                                            onPress={() => updateGroup(gIndex, 'max_selection', 5)}
                                                        >
                                                            <Text style={{ color: group.max_selection > 1 ? '#fff' : theme.text, fontSize: 12 }}>Multiple Choice</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                {group.items.map((item, iIndex) => (
                                                    <View key={iIndex} style={styles.optionRow}>
                                                        <View style={{ flex: 2 }}>
                                                            <Input
                                                                placeholder="Option Name"
                                                                value={item.name}
                                                                onChangeText={(text) => updateOption(gIndex, iIndex, 'name', text)}
                                                                containerStyle={{ marginBottom: 0 }}
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Input
                                                                placeholder="+0.00"
                                                                keyboardType="numeric"
                                                                value={item.price}
                                                                onChangeText={(text) => updateOption(gIndex, iIndex, 'price', text)}
                                                                containerStyle={{ marginBottom: 0 }}
                                                            />
                                                        </View>
                                                        <TouchableOpacity onPress={() => removeOption(gIndex, iIndex)}>
                                                            <Ionicons name="close-circle" size={24} color={theme.icon} />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}

                                                <TouchableOpacity onPress={() => addOption(gIndex)} style={{ marginTop: 8 }}>
                                                    <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>+ Add Choice</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>

                            <Button
                                title={initialData ? "Update Product" : "Create Product"}
                                onPress={handleSubmit}
                                loading={loading}
                                style={{ marginTop: 20 }}
                            />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 20 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    title: { fontSize: 24, fontWeight: 'bold' },
    imageUpload: {
        height: 200,
        marginHorizontal: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 6,
        marginLeft: 4
    },
    catPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
    },
    variantCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#e0e0e0', // default gray
    },
    optionRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        marginBottom: 8
    },
    libraryContainer: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginBottom: 16
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(150,150,150,0.1)',
        padding: 8,
        borderRadius: 8
    }
});
