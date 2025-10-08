import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:flutter_layout_grid/flutter_layout_grid.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/gallery_service.dart';

class GalleryScreen extends StatefulWidget {
  final String householdId;
  final String? householdName;

  const GalleryScreen({
    super.key,
    required this.householdId,
    this.householdName,
  });

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  final List<GalleryImage> _images = [];
  bool _isLoading = true;
  String _householdName = 'Your Family';

  @override
  void initState() {
    super.initState();
    _initializeGallery();
  }

  Future<void> _initializeGallery() async {
    // Fetch household name first (quick)
    if (widget.householdName != null) {
      _householdName = widget.householdName!;
    } else {
      final name =
          await GalleryService.instance.getHouseholdName(widget.householdId);
      if (name != null && mounted) {
        setState(() {
          _householdName = name;
        });
      }
    }

    // Then load images
    await _loadImages();
  }

  Future<void> _loadImages() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final images =
          await GalleryService.instance.loadGalleryImages(widget.householdId);
      setState(() {
        _images.clear();
        _images.addAll(images);
        _isLoading = false;
      });
    } catch (e) {
      if (kDebugMode) {
        print('[GalleryScreen] Error loading images: $e');
      }
      setState(() {
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Failed to load gallery: $e',
              style: GoogleFonts.fraunces(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _openImageViewer(int initialIndex) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _ImageViewerScreen(
          images: _images,
          initialIndex: initialIndex,
          onDownload: _downloadImage,
        ),
      ),
    );
  }

  Future<void> _downloadImage(GalleryImage image) async {
    try {
      final result = await GalleryService.instance.downloadImageToGallery(
        image.url,
        fileName: 'callpanion_memory_${image.id}',
      );

      if (mounted) {
        final success = result['success'] as bool;
        final message = result['message'] as String;

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              success ? '✓ $message' : message,
              style: GoogleFonts.fraunces(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
            backgroundColor: success ? const Color(0xFFE38B6F) : Colors.red,
            duration: Duration(seconds: success ? 2 : 4),
            action: !success && message.contains('permission')
                ? SnackBarAction(
                    label: 'Settings',
                    textColor: Colors.white,
                    onPressed: () async {
                      // Permission handler will auto-open settings
                      await GalleryService.instance.downloadImageToGallery(
                        image.url,
                        fileName: 'callpanion_memory_${image.id}',
                      );
                    },
                  )
                : null,
          ),
        );
      }
    } catch (e) {
      if (kDebugMode) {
        print('[GalleryScreen] Error downloading image: $e');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Error: ${e.toString().split(':').first}',
              style: GoogleFonts.fraunces(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(date.year, date.month, date.day);

    if (messageDate == today) {
      return 'Today ${DateFormat('HH:mm').format(date)}';
    } else if (messageDate == today.subtract(const Duration(days: 1))) {
      return 'Yesterday ${DateFormat('HH:mm').format(date)}';
    } else {
      return DateFormat('MMM d, yyyy').format(date);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: PreferredSize(
        // 🔧 ATUR TINGGI HEADER DI SINI (default: 100)
        preferredSize: const Size.fromHeight(100),
        child: AppBar(
          // 🔧 ATUR CENTER TITLE DI SINI (true/false)
          centerTitle: true,
          // 🔧 ATUR TITLE SPACING DI SINI (jarak kiri-kanan)
          titleSpacing: 0,
          // 🔧 ATUR TOOLBAR HEIGHT DI SINI (tinggi toolbar)
          toolbarHeight: 100,
          // 🔧 ATUR AUTOMATICALLY IMPLY LEADING DI SINI (true/false)
          automaticallyImplyLeading: true,
          // 🔧 TITLE DIPINDAH KE FLEXIBLE SPACE
          flexibleSpace: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              // 🔧 ATUR SHADOW DI SINI (akan muncul saat scroll)
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: SafeArea(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      'Shared with you',
                      style: GoogleFonts.fraunces(
                        // 🔧 ATUR FONT SIZE HEADER DI SINI (default: 24)
                        fontSize: 24,
                        // 🔧 ATUR FONT WEIGHT HEADER DI SINI (w400, w500, w600, w700, w800)
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0F3B2E),
                      ),
                    ),
                    // 🔧 ATUR JARAK ANTARA HEADER DAN SUBHEADER DI SINI (default: 6)
                    const SizedBox(height: 6),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 60.0),
                      child: Text(
                        'Stay close with family through photos and memories',
                        style: GoogleFonts.fraunces(
                          // 🔧 ATUR FONT SIZE SUBHEADER DI SINI (default: 14)
                          fontSize: 14,
                          // 🔧 ATUR FONT WEIGHT SUBHEADER DI SINI (w400, w500, w600)
                          fontWeight: FontWeight.w400,
                          color: const Color(0xFF0F3B2E).withOpacity(0.7),
                        ),
                        textAlign: TextAlign.center,
                        // 🔧 ATUR MAX LINES SUBHEADER DI SINI (default: 2)
                        maxLines: 2,
                        // 🔧 ATUR OVERFLOW SUBHEADER DI SINI (ellipsis, clip, fade)
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF0F3B2E),
          elevation: 0,
          surfaceTintColor: Colors.white,
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(1),
            child: Container(
              height: 1,
              color: const Color(0xFFE38B6F),
            ),
          ),
          actions: [
            Container(
              height: 100,
              child: SafeArea(
                child: Center(
                  child: IconButton(
                    icon: const Icon(Icons.refresh),
                    onPressed: _loadImages,
                    tooltip: 'Refresh',
                    color: const Color(0xFF0F3B2E),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(
                color: const Color(0xFFE38B6F),
              ),
            )
          : _images.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.photo_library_outlined,
                        size: 80,
                        color: Colors.grey[400],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'No memories yet',
                        style: GoogleFonts.fraunces(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF0F3B2E),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Photos shared in chat will appear here',
                        style: GoogleFonts.fraunces(
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                          color: const Color(0xFF0F3B2E).withOpacity(0.7),
                        ),
                      ),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: LayoutGrid(
                    columnSizes: [1.fr, 1.fr],
                    rowSizes: List.generate(
                      (_images.length / 2).ceil(),
                      (index) => auto,
                    ),
                    columnGap: 12,
                    rowGap: 12,
                    children: List.generate(_images.length, (index) {
                      final image = _images[index];
                      return GestureDetector(
                        onTap: () => _openImageViewer(index),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: const Color(0xFFE4B8AC),
                              width: 1,
                            ),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Stack(
                              children: [
                                AspectRatio(
                                  aspectRatio: 1,
                                  child: CachedNetworkImage(
                                    imageUrl: image.url,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => Container(
                                      color: Colors.grey[300],
                                      child: const Center(
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      ),
                                    ),
                                    errorWidget: (context, url, error) =>
                                        Container(
                                      color: Colors.grey[300],
                                      child: const Icon(
                                        Icons.error,
                                        color: Colors.red,
                                      ),
                                    ),
                                  ),
                                ),
                                // Gradient overlay for text readability
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  child: Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [
                                          Colors.transparent,
                                          Colors.black.withOpacity(0.7),
                                        ],
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        if (image.caption != null &&
                                            image.caption!.isNotEmpty)
                                          Text(
                                            image.caption!,
                                            style: GoogleFonts.fraunces(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500,
                                            ),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        const SizedBox(height: 4),
                                        Text(
                                          _formatDate(image.createdAt),
                                          style: GoogleFonts.fraunces(
                                            color: Colors.white70,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w400,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
    );
  }
}

class _ImageViewerScreen extends StatefulWidget {
  final List<GalleryImage> images;
  final int initialIndex;
  final Future<void> Function(GalleryImage) onDownload;

  const _ImageViewerScreen({
    required this.images,
    required this.initialIndex,
    required this.onDownload,
  });

  @override
  State<_ImageViewerScreen> createState() => _ImageViewerScreenState();
}

class _ImageViewerScreenState extends State<_ImageViewerScreen> {
  late PageController _pageController;
  late int _currentIndex;
  bool _isDownloading = false;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _downloadCurrent() async {
    if (_isDownloading) return;

    setState(() {
      _isDownloading = true;
    });

    await widget.onDownload(widget.images[_currentIndex]);

    if (mounted) {
      setState(() {
        _isDownloading = false;
      });
    }
  }

  String _formatDateTime(DateTime date) {
    return DateFormat('EEEE, MMMM d, yyyy • HH:mm').format(date);
  }

  @override
  Widget build(BuildContext context) {
    final currentImage = widget.images[_currentIndex];

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black87,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          '${_currentIndex + 1} / ${widget.images.length}',
          style: GoogleFonts.fraunces(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: _isDownloading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Icon(Icons.download),
            onPressed: _isDownloading ? null : _downloadCurrent,
            tooltip: 'Download',
          ),
        ],
      ),
      body: Stack(
        children: [
          PhotoViewGallery.builder(
            scrollPhysics: const BouncingScrollPhysics(),
            builder: (BuildContext context, int index) {
              return PhotoViewGalleryPageOptions(
                imageProvider: CachedNetworkImageProvider(
                  widget.images[index].url,
                ),
                minScale: PhotoViewComputedScale.contained,
                maxScale: PhotoViewComputedScale.covered * 2,
                heroAttributes:
                    PhotoViewHeroAttributes(tag: widget.images[index].id),
              );
            },
            itemCount: widget.images.length,
            loadingBuilder: (context, event) => const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
            backgroundDecoration: const BoxDecoration(
              color: Colors.black,
            ),
            pageController: _pageController,
            onPageChanged: (index) {
              setState(() {
                _currentIndex = index;
              });
            },
          ),
          // Image info overlay
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withOpacity(0.8),
                  ],
                ),
              ),
              child: SafeArea(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (currentImage.caption != null &&
                        currentImage.caption!.isNotEmpty) ...[
                      Text(
                        currentImage.caption!,
                        style: GoogleFonts.fraunces(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      _formatDateTime(currentImage.createdAt),
                      style: GoogleFonts.fraunces(
                        color: Colors.white70,
                        fontSize: 14,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      currentImage.senderType == 'family'
                          ? 'From Family'
                          : 'From You',
                      style: GoogleFonts.fraunces(
                        color: currentImage.senderType == 'family'
                            ? const Color(0xFFE38B6F)
                            : const Color(0xFF0F3B2E),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
