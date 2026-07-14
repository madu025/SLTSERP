import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Clock, Eye, Plus, ChevronRight, HelpCircle, Pencil, Trash2, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateKBArticleSchema } from "@/lib/validations/helpdesk.schema";
import { z } from "zod";

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  views: number;
  createdAt: string | Date;
}

interface KBArticleViewProps {
  articles: KBArticle[];
  onSearch: (query: string, category: string) => void;
  onAddArticle: (data: z.infer<typeof CreateKBArticleSchema>) => Promise<void>;
  onEditArticle?: (id: string, data: { title?: string; content?: string; category?: string }) => Promise<void>;
  onDeleteArticle?: (id: string) => Promise<void>;
  isStaff?: boolean;
}

export default function KBArticleView({
  articles,
  onSearch,
  onAddArticle,
  onEditArticle,
  onDeleteArticle,
  isStaff = false
}: KBArticleViewProps) {
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categories = ["All", "VPN", "Outlook", "Printers", "Passwords", "Windows", "Network"];

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(CreateKBArticleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "Windows"
    }
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onSearch(val, selectedCategory === "All" ? "" : selectedCategory);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    onSearch(searchQuery, category === "All" ? "" : category);
  };

  const onSubmit = async (data: z.infer<typeof CreateKBArticleSchema>) => {
    setSaving(true);
    try {
      await onAddArticle(data);
      reset();
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openEditMode = (art: KBArticle) => {
    setEditTitle(art.title);
    setEditContent(art.content);
    setEditCategory(art.category);
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedArticle || !onEditArticle) return;
    setEditSaving(true);
    try {
      await onEditArticle(selectedArticle.id, {
        title: editTitle,
        content: editContent,
        category: editCategory
      });
      setEditMode(false);
      setSelectedArticle({ ...selectedArticle, title: editTitle, content: editContent, category: editCategory });
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!deleteConfirmId || !onDeleteArticle) return;
    setDeleting(true);
    try {
      await onDeleteArticle(deleteConfirmId);
      setDeleteConfirmId(null);
      setSelectedArticle(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search solutions: 'VPN', 'Printer offline'..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9 text-xs h-9 bg-card border border-border/60"
          />
        </div>

        {/* Add Article (IT Staff only) */}
        {isStaff && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 transition-all hover:scale-103 bg-primary hover:bg-primary/95 text-xs text-white">
                <Plus className="h-4 w-4" />
                Add KB Article
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border border-border/50">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">Write FAQ/KB Article</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Title</label>
                  <Input
                    {...register("title")}
                    placeholder="e.g. How to connect to Corporate VPN"
                    className="h-8 text-xs bg-muted/20 border-border"
                  />
                  {errors.title && <p className="text-[10px] text-red-500">{errors.title.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Category</label>
                  <Input
                    {...register("category")}
                    placeholder="e.g. VPN, Printers, Passwords"
                    className="h-8 text-xs bg-muted/20 border-border"
                  />
                  {errors.category && <p className="text-[10px] text-red-500">{errors.category.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Content / Steps</label>
                  <Textarea
                    {...register("content")}
                    placeholder="Describe step-by-step instructions to solve the problem..."
                    rows={8}
                    className="text-xs bg-muted/20 border-border"
                  />
                  {errors.content && <p className="text-[10px] text-red-500">{errors.content.message}</p>}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs text-white bg-primary">
                    {saving ? "Publishing..." : "Publish Article"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5 py-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategorySelect(cat)}
            className={`px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${
              (selectedCategory === cat || (cat === "All" && selectedCategory === ""))
                ? "bg-primary/10 text-primary border-primary/45 font-medium"
                : "bg-card text-muted-foreground border-border/60 hover:bg-muted/30"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Article Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {articles.length === 0 ? (
          <div className="md:col-span-2 text-center py-10 bg-card rounded-lg border border-border/50">
            <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No articles match your search</p>
             <p className="text-xs text-muted-foreground/70">Try searching for other keywords like &quot;password&quot;, &quot;VPN&quot;, or &quot;printer&quot;.</p>
          </div>
        ) : (
          articles.map((art) => (
            <Card
              key={art.id}
              className="bg-card/75 border border-border/50 hover:border-primary/45 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between"
              onClick={() => setSelectedArticle(art)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start gap-2">
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[9px] uppercase font-bold border-none">
                    {art.category}
                  </Badge>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-0.5">
                      <Eye className="h-3 w-3" />
                      <span>{art.views} views</span>
                    </div>
                  </div>
                </div>
                <CardTitle className="text-sm font-bold text-foreground/90 mt-1.5 leading-snug">
                  {art.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed mb-3">
                  {art.content}
                </p>
                <div className="flex items-center text-[10px] font-semibold text-primary gap-1">
                  <span>Read Article</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Article Detail Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => { if (!open) { setSelectedArticle(null); setEditMode(false); } }}>
        {selectedArticle && (
          <DialogContent className="max-w-xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
            <DialogHeader className="border-b border-border/40 pb-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!editMode ? (
                    <Badge className="bg-primary/10 text-primary border-none text-[9px] uppercase font-bold">
                      {selectedArticle.category}
                    </Badge>
                  ) : (
                    <input
                      className="text-[9px] uppercase font-bold border border-border/50 rounded px-2 py-0.5 bg-muted/20 w-28"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                    />
                  )}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Published {new Date(selectedArticle.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {isStaff && !editMode && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={() => openEditMode(selectedArticle)}
                      title="Edit article"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => setDeleteConfirmId(selectedArticle.id)}
                      title="Delete article"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              {editMode ? (
                <input
                  className="text-base font-extrabold bg-muted/20 border border-border/50 rounded px-2 py-1 mt-2 w-full"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              ) : (
                <DialogTitle className="text-base font-extrabold text-foreground mt-2 leading-snug">
                  {selectedArticle.title}
                </DialogTitle>
              )}
            </DialogHeader>
            {editMode ? (
              <textarea
                className="py-4 text-xs text-foreground/80 leading-relaxed flex-grow bg-muted/20 border border-border/50 rounded p-2 resize-none w-full"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={10}
              />
            ) : (
              <div className="py-4 text-xs text-foreground/80 space-y-3 leading-relaxed overflow-y-auto pr-1 flex-grow whitespace-pre-line select-text">
                {selectedArticle.content}
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-border/40 flex-shrink-0">
              {editMode ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditMode(false)}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" disabled={editSaving} className="h-8 text-xs text-white bg-primary" onClick={handleSaveEdit}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {editSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  <span>{selectedArticle.views} views</span>
                </div>
              )}
              {!editMode && (
                <Button size="sm" onClick={() => setSelectedArticle(null)} className="h-8 text-xs text-white bg-primary">
                  Done Reading
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete KB Article Confirm */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" />
              Delete KB Article
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground py-2">
            Are you sure you want to permanently delete this article? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button size="sm" disabled={deleting} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteArticle}>
              {deleting ? "Deleting..." : "Delete Article"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
